import { FILEREAD_CHUNK_SIZE, BACKEND_URL } from "./Constants";
import Lang from "./Lang";
import { ReadableStream, WritableStream } from "web-streams-polyfill";

interface FileState {
  token: string;
  uuid: string;
}

export function createFileReadable(file: File): ReadableStream {
  let offset = 0;
  const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });

  return new ReadableStream(
    {
      async pull(cntrl) {
        if (cntrl.desiredSize !== null && cntrl.desiredSize <= 0) {
          return;
        }
        const read = await file
          .slice(offset, offset + FILEREAD_CHUNK_SIZE)
          .arrayBuffer();

        if (read.byteLength === 0) {
          return cntrl.close();
        }
        offset += FILEREAD_CHUNK_SIZE;
        cntrl.enqueue(new Uint8Array(read));
      },
    },
    queuingStrategy
  );
}

export async function getFileLoadStream(
    abortSignal: AbortSignal,
    uuid: string
): Promise<[number, ReadableStream<Uint8Array>]> {
  const response = await fetch(`${BACKEND_URL}/filedownload/${uuid}`, {
    signal: abortSignal,
    method: "GET",
  });

  if (response.status !== 200) {
    const errorText = await response.text();
    throw new Error(
        `Error occured while fetching file. status: ${response.status}, body: ${errorText}`
    );
  }

  const filesize = parseInt(response.headers.get("content-length") as string);
  const stream = response.body;
  if (stream === null) {
    throw new Error("No response.body object.");
  }
  return [filesize, stream as ReadableStream<Uint8Array>];
}
