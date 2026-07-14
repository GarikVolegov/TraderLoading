import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// The chat/social surface used to live entirely in pages/Chat.tsx. It has been
// split into a feature folder (components/social/**). These checks assert that
// the behaviour/copy still exists somewhere in that feature, regardless of the
// exact file it now lives in — so the test survives further decomposition.
function readFeatureSource(): string {
  const files = ["src/pages/Chat.tsx"];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk("src/components/social");
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

const source = readFeatureSource();
const socialRoute = fs.readFileSync("../api-server/src/routes/social.ts", "utf8");

assert.match(source, /useSearchUsers/);
assert.match(source, /useSendFriendRequest/);
assert.match(source, /useGetPendingFriendRequests/);
assert.match(source, /useRespondToFriendRequest/);
// Copy passata all'i18n durante il sweep Fase 3: chiave in pagina, testo nel catalogo.
assert.match(source, /auto\.ui\.7fd20b6519/); // "Aggiungi amico"
assert.match(source, /auto\.ui\.f4fbb496bb/); // "Richiesta inviata"
assert.match(source, /auto\.ui\.4555767847/); // "Richieste amicizia"
assert.match(source, /auto\.ui\.ab8585e7c5/); // "Accetta"
assert.match(source, /auto\.ui\.68b880f2a6/); // "Rifiuta"
{
  const itDict = fs.readFileSync("src/lib/i18n/dict.it.ts", "utf8");
  assert.match(itDict, /"auto\.ui\.7fd20b6519":\s*"Aggiungi amico"/);
  assert.match(itDict, /"auto\.ui\.f4fbb496bb":\s*"Richiesta inviata"/);
  assert.match(itDict, /"auto\.ui\.4555767847":\s*"Richieste amicizia"/);
  assert.match(itDict, /"auto\.ui\.ab8585e7c5":\s*"Accetta"/);
  assert.match(itDict, /"auto\.ui\.68b880f2a6":\s*"Rifiuta"/);
}
assert.match(source, /acceptedFriends/);
assert.match(source, /messageContacts/);
assert.match(source, /friendUserId/);
assert.match(source, /min-w-\[260px\]/);
// L'aria-label del vocale è passata all'i18n: chiave in pagina, copy nel catalogo.
assert.match(source, /aria-label=\{uiText\("auto\.ui\.fe60a4fba4"\)\}/);
assert.match(
  fs.readFileSync("src/lib/i18n/dict.it.ts", "utf8"),
  /"auto\.ui\.fe60a4fba4":\s*"Messaggio vocale"/,
);
assert.match(source, /"video" \| "file"/);
assert.match(source, /social\/upload-file/);
assert.match(source, /<video/);
assert.match(source, /controls/);
assert.match(source, /accept="\*"/);
assert.match(source, /fileName/);
assert.match(source, /mimeType/);
assert.match(source, /Download/);
assert.match(source, /useToast/);
assert.match(source, /const \{ toast \} = useToast\(\);/);
assert.match(source, /fallbackMessage: "Upload file non riuscito\."/);
assert.match(source, /className="flex flex-col h-full min-h-0 overflow-hidden relative"/);
assert.match(source, /className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"/);
assert.match(source, /className="h-full min-h-0"/);
assert.match(source, /className="flex-1 min-h-0 overflow-hidden"/);
// Mobile reclaims the space freed by the now-hidden page title; desktop keeps the title-inclusive offset.
assert.match(source, /h-\[calc\(100dvh-var\(--safe-top\)-4\.6rem-var\(--bottom-nav-clearance\)\)\]/);
assert.match(source, /sm:h-\[calc\(100dvh-var\(--safe-top\)-8\.5rem-var\(--bottom-nav-clearance\)\)\]/);
assert.match(source, /function ClassificaTab\(\{ currentUserId \}/);
assert.match(source, /const \[viewingProfile, setViewingProfile\] = useState<string \| null>\(null\);/);
assert.match(source, /onClick=\{\(\) => canViewProfile && entry\.userId && setViewingProfile\(entry\.userId\)\}/);
assert.match(source, /<Avatar\s+name=\{entry\.name\}\s+avatarUrl=\{entry\.avatarUrl\}\s+size="sm"/);
assert.match(source, /<UserProfileModal[\s\S]*userId=\{viewingProfile\}[\s\S]*currentUserId=\{currentUserId\}/);

assert.match(socialRoute, /upload-file/);
assert.match(socialRoute, /chat-files/);
assert.match(socialRoute, /50 \* 1024 \* 1024/);
assert.match(socialRoute, /\.exe/);
assert.match(socialRoute, /\.ps1/);

console.log("chat friend request static checks passed");
