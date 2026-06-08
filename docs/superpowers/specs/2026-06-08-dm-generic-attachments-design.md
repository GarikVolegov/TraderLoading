# DM Generic Attachments Design

## Goal

Direct messages must support sending more than photos. Users should be able to attach videos, PDFs, archives, spreadsheets, text files, and other common document types from the existing DM attachment button.

## Current Behavior

`artifacts/trader-dashboard/src/pages/Chat.tsx` supports encrypted DM payloads with:

- `text`
- `image`
- `voice`

Images are uploaded through `POST /social/upload-image`; recorded audio is uploaded through `POST /social/upload-voice`. The encrypted message body stores a JSON payload for images and voice notes, then `renderBubble` chooses the visual treatment by `msg.type`.

## Design

Add a generic file attachment flow for DMs.

The frontend will use the existing attachment button and file input, but the input will accept any file. When a file is selected:

- image files keep the current image preview behavior;
- video files upload as a generic attachment and render as a video player;
- PDFs and other files upload as generic attachments and render as a compact file card with name, size, type, and open/download action.

The backend will add `POST /social/upload-file`, storing files under `uploads/chat-files`. It will allow common file types without locking the feature to only PDF/video. The max file size is 50 MB.

The encrypted message payload for non-image files will be:

```ts
{
  type: "video" | "file";
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}
```

Existing image and voice messages remain backward-compatible.

## UI Behavior

Images continue to render inline as image bubbles.

Videos render inline with:

- `<video controls>`;
- stable max width;
- a short file-name label if available.

Other files render as a document card with:

- file icon;
- original file name;
- formatted file size;
- MIME type or extension;
- open/download button using the uploaded URL.

The send button should show the existing upload spinner while any attachment upload is in flight.

## Error Handling

- Empty selection does nothing.
- Oversized files return a 400 error from the server.
- Upload failure logs through `reportClientError`, clears the file input, and does not send a broken encrypted message.
- Unknown MIME types are accepted as `application/octet-stream` style attachments if the file extension is safe.

## Security Notes

The file contents are stored as uploaded files, while the message metadata is E2EE-encrypted. This matches the current image/voice model. The server should avoid executable/script-style uploads where possible by excluding extensions such as `.exe`, `.bat`, `.cmd`, `.ps1`, `.sh`, `.js`, `.html`, and `.svg`.

## Testing

Backend/static tests should verify:

- `upload-file` route exists;
- the upload limit is 50 MB;
- blocked extensions are listed.

Frontend/static tests should verify:

- DM decrypted type includes `video` and `file`;
- the DM file input accepts any file;
- file selection routes images to image messages, videos to video messages, and other files to file messages;
- `renderBubble` renders `<video controls>` for video;
- `renderBubble` renders a document card with download/open action for generic files.

## Verification

- `pnpm test`
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/trader-dashboard run typecheck`

## Self-Review

- The design keeps existing image and voice messages compatible.
- The new endpoint has a clear size limit and storage location.
- The UI uses the current DM attachment control instead of adding a separate flow.
- File metadata is encrypted in the message payload.
