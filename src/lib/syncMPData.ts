import { prisma } from "./prisma";

const MEMBERS_API =
  "https://members-api.parliament.uk/api/Members/Search?House=Commons&IsCurrentMember=true&take=20&skip=";

const CONTACT_CSV_URL =
  "https://www.parliament.uk/mps-lords-and-offices/offices/commons/house-of-commons-publication-scheme/members-and-members-staff/parliamentary-contact-details-for-mps/";

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

// Parse the parliament.uk contact details page — it embeds a CSV download link
// or we can try the direct CSV. Fall back gracefully if unavailable.
async function fetchEmailMap(): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();

  try {
    // The page links to a CSV — try fetching it directly via a known pattern
    const csvRes = await fetch(CONTACT_CSV_URL, {
      headers: { Accept: "text/csv,text/html,*/*" },
    });
    if (!csvRes.ok) {
      throw new Error(`CSV fetch returned ${csvRes.status}`);
    }

    const contentType = csvRes.headers.get("content-type") ?? "";
    const text = await csvRes.text();

    if (contentType.includes("text/csv") || text.includes(",")) {
      parseCSVIntoMap(text, emailMap);
    } else {
      // HTML page returned — try to find the embedded CSV link
      const match = text.match(/href="([^"]+\.csv[^"]*)"/i);
      if (match) {
        const csvLinkRes = await fetch(match[1]);
        if (csvLinkRes.ok) {
          parseCSVIntoMap(await csvLinkRes.text(), emailMap);
        }
      }
    }
  } catch {
    // Caller handles the empty map as a warning
  }

  return emailMap;
}

function parseCSVIntoMap(csv: string, map: Map<string, string>) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const emailIdx = headers.findIndex(
    (h) => h.includes("email") || h.includes("e-mail")
  );

  if (nameIdx === -1 || emailIdx === -1) return;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    const email = cols[emailIdx]?.trim();
    if (name && email && email.includes("@")) {
      map.set(normaliseName(name), email);
    }
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|sir|dame|lord|lady|the rt hon|rt hon|mp)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function syncMPData(): Promise<SyncResult> {
  const warnings: string[] = [];
  const syncedAt = new Date();

  // --- Fetch Members API ---
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

  // --- Fetch email CSV ---
  let emailMap: Map<string, string>;
  try {
    emailMap = await fetchEmailMap();
    if (emailMap.size === 0) {
      warnings.push("Email CSV could not be fetched or parsed — MP emails not updated this run.");
    }
  } catch {
    emailMap = new Map();
    warnings.push("Email CSV fetch failed — MP emails not updated this run.");
  }

  // --- Build combined MP records ---
  const mpRecords: MPRecord[] = members
    .map((m) => {
      const v = m.value;
      const constituency = v.latestHouseMembership?.membershipFrom ?? "";
      if (!constituency) return null;

      const normName = normaliseName(v.nameDisplayAs);
      const email = emailMap.get(normName) ?? null;

      return {
        parliamentId: String(v.id),
        fullName: v.nameDisplayAs,
        constituency,
        party: v.latestParty?.name ?? "",
        photoUrl: v.thumbnailUrl ?? "",
        email,
      } as MPRecord;
    })
    .filter((r): r is MPRecord => r !== null);

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
        // Still update lastSyncedAt
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
        data: {
          name: mp.constituency,
          ...newData,
        },
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
