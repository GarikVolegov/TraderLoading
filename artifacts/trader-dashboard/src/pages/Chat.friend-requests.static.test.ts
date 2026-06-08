import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/Chat.tsx", "utf8");
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
assert.match(source, /aria-label="Messaggio vocale"/);
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

assert.match(socialRoute, /upload-file/);
assert.match(socialRoute, /chat-files/);
assert.match(socialRoute, /50 \* 1024 \* 1024/);
assert.match(socialRoute, /\.exe/);
assert.match(socialRoute, /\.ps1/);

console.log("chat friend request static checks passed");
