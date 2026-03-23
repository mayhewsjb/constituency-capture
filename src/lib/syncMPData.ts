import { prisma } from "./prisma";

const MEMBERS_API =
  "https://members-api.parliament.uk/api/Members/Search?House=Commons&IsCurrentMember=true&take=20&skip=";

const CONTACT_API = (id: string) =>
  `https://members-api.parliament.uk/api/Members/${id}/Contact`;

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  unchanged: number;
  total: number;
  syncedAt: Date;
  warnings: string[];
  error?: string;
}

interface ParliamentMember {
  id: number;
  value: {
    id: number;
    nameDisplayAs: string;
    latestParty: { name: string };
    latestHouseMembership: { membershipFrom: string };
    thumbnailUrl: string;
  };
}

interface MPRecord {
  parliamentId: string;
  fullName: string;
  constituency: string;
  party: string;
  photoUrl: string;
  email: string | null;
}

async function fetchAllMembers(): Promise<ParliamentMember[]> {
  const all: ParliamentMember[] = [];
  let skip = 0;

  while (true) {
    const res = await fetch(`${MEMBERS_API}${skip}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Members API returned ${res.status} at skip=${skip}`);
    }
    const data = await res.json();
    const items: ParliamentMember[] = data.items ?? [];
    if (items.length === 0) break;
    all.push(...items);
    if (all.length >= (data.totalResults ?? 0)) break;
    skip += 20;
  }

  return all;
}

async function fetchEmailForMember(parliamentId: string): Promise<string | null> {
  try {
    const res = await fetch(CONTACT_API(parliamentId), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const contacts: { typeId: number; email?: string | null }[] = data.value ?? [];
    // typeId 1 = Parliamentary office — most reliable email
    const parliamentary = contacts.find((c) => c.typeId === 1);
    return parliamentary?.email ?? null;
  } catch {
    return null;
  }
}

// Fetch emails for all members with bounded concurrency to avoid rate limiting
async function fetchAllEmails(
  parliamentIds: string[],
  concurrency = 5
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  const queue = [...parliamentIds];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      const email = await fetchEmailForMember(id);
      if (email) emailMap.set(id, email);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return emailMap;
}

export async function syncMPData(): Promise<SyncResult> {
  const warnings: string[] = [];
  const syncedAt = new Date();

  // --- Fetch all current MPs ---
  let members: ParliamentMember[];
  try {
    members = await fetchAllMembers();
  } catch (err) {
    return {
      success: false,
      created: 0,
      updated: 0,
      unchanged: 0,
      total: 0,
      syncedAt,
      warnings,
      error: `Members API unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // --- Build base records from Members API ---
  const baseRecords = members
    .map((m) => {
      const v = m.value;
      const constituency = v.latestHouseMembership?.membershipFrom ?? "";
      if (!constituency) return null;
      return {
        parliamentId: String(v.id),
        fullName: v.nameDisplayAs,
        constituency,
        party: v.latestParty?.name ?? "",
        photoUrl: v.thumbnailUrl ?? "",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // --- Fetch emails via Contact API (5 concurrent requests) ---
  let emailMap: Map<string, string>;
  try {
    emailMap = await fetchAllEmails(baseRecords.map((r) => r.parliamentId));
    if (emailMap.size === 0) {
      warnings.push("Contact API returned no emails — MP emails not updated this run.");
    }
  } catch {
    emailMap = new Map();
    warnings.push("Contact API fetch failed — MP emails not updated this run.");
  }

  // --- Combine ---
  const mpRecords: MPRecord[] = baseRecords.map((r) => ({
    ...r,
    email: emailMap.get(r.parliamentId) ?? null,
  }));

  // --- Upsert into DB ---
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const mp of mpRecords) {
    const existing = await prisma.constituency.findUnique({
      where: { name: mp.constituency },
    });

    const newData = {
      mpName: mp.fullName,
      mpEmail: mp.email,
      mpParty: mp.party,
      mpParliamentId: mp.parliamentId,
      mpPhotoUrl: mp.photoUrl,
      lastSyncedAt: syncedAt,
    };

    if (existing) {
      const isUnchanged =
        existing.mpName === newData.mpName &&
        existing.mpEmail === newData.mpEmail &&
        existing.mpParty === newData.mpParty &&
        existing.mpParliamentId === newData.mpParliamentId &&
        existing.mpPhotoUrl === newData.mpPhotoUrl;

      if (isUnchanged) {
        await prisma.constituency.update({
          where: { name: mp.constituency },
          data: { lastSyncedAt: syncedAt },
        });
        unchanged++;
      } else {
        await prisma.constituency.update({
          where: { name: mp.constituency },
          data: newData,
        });
        updated++;
      }
    } else {
      await prisma.constituency.create({
        data: { name: mp.constituency, ...newData },
      });
      created++;
    }
  }

  return {
    success: true,
    created,
    updated,
    unchanged,
    total: mpRecords.length,
    syncedAt,
    warnings,
  };
}
