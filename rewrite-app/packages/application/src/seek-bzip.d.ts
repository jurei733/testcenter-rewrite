declare module "seek-bzip" {
  const bunzip: {
    decode(
      input: {
        read(target: Buffer, offset: number, length: number): number;
        readByte(): number;
      },
      output: { writeByte(byte: number): void }
    ): void;
  };
  export default bunzip;
}
