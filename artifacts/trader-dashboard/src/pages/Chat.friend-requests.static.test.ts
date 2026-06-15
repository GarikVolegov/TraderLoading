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
assert.match(source, /Aggiungi amico/);
assert.match(source, /Richiesta inviata/);
assert.match(source, /Richieste amicizia/);
assert.match(source, /Accetta/);
assert.match(source, /Rifiuta/);
assert.match(source, /acceptedFriends/);
assert.match(source, /messageContacts/);
assert.match(source, /friendUserId/);
assert.match(source, /min-w-\[260px\]/);
// L'aria-label del vocale è passata all'i18n: chiave in pagina, copy nel catalogo.
assert.match(source, /aria-label=\{uiText\("auto\.ui\.fe60a4fba4"\)\}/);
assert.match(
  fs.readFileSync("src/lib/i18n.ts", "utf8"),
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
assert.match(source, /style=\{\{ height: "calc\(100dvh - 180px\)" \}\}/);
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
