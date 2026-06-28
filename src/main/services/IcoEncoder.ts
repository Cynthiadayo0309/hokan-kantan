export type IcoImageEntry = {
  width: number;
  height: number;
  png: Buffer;
};

export function buildIcoBuffer(entries: IcoImageEntry[]): Buffer {
  if (entries.length === 0) {
    throw new Error("アイコン画像を作成できませんでした。");
  }

  const headerSize = 6;
  const directorySize = 16 * entries.length;
  const header = Buffer.alloc(headerSize + directorySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let imageOffset = headerSize + directorySize;
  const images: Buffer[] = [];

  entries.forEach((entry, index) => {
    validateEntry(entry);
    const directoryOffset = headerSize + index * 16;
    header.writeUInt8(iconDimension(entry.width), directoryOffset);
    header.writeUInt8(iconDimension(entry.height), directoryOffset + 1);
    header.writeUInt8(0, directoryOffset + 2);
    header.writeUInt8(0, directoryOffset + 3);
    header.writeUInt16LE(1, directoryOffset + 4);
    header.writeUInt16LE(32, directoryOffset + 6);
    header.writeUInt32LE(entry.png.length, directoryOffset + 8);
    header.writeUInt32LE(imageOffset, directoryOffset + 12);
    images.push(entry.png);
    imageOffset += entry.png.length;
  });

  return Buffer.concat([header, ...images]);
}

function iconDimension(value: number): number {
  return value >= 256 ? 0 : value;
}

function validateEntry(entry: IcoImageEntry): void {
  if (!Number.isInteger(entry.width) || entry.width < 1 || entry.width > 256 || !Number.isInteger(entry.height) || entry.height < 1 || entry.height > 256) {
    throw new Error("アイコン画像のサイズが不正です。");
  }
  if (!entry.png.length) {
    throw new Error("アイコン画像を作成できませんでした。");
  }
}
