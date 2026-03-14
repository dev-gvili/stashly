// tokenizers-augment.d.ts
declare module "@huggingface/tokenizers" {
  export type TokenizerJSON = { [key: string]: any };

  export interface EncodeOptions {
    addSpecialTokens?: boolean;
    truncation?: boolean | { maxLength?: number };
    padding?: boolean | { maxLength?: number };
    // extend as needed
  }

  export interface Encoding {
    ids: number[];
    attentionMask?: number[];
    tokenTypeIds?: number[];
    // extend as needed
  }

  export class Tokenizer {
    // instance API (partial; add more signatures if you use them)
    constructor(tokenizer: object, config?: object);
    encode(text: string, options?: EncodeOptions): Encoding;
    decode(tokenIds: number[] | bigint[], options?: { skipSpecialTokens?: boolean }): string;
    tokenize(text: string, options?: { text_pair?: string; add_special_tokens?: boolean }): string[];
    token_to_id(token: string): number | undefined;
    id_to_token(id: number): string | undefined;

    // static factory that exists at runtime but is missing from the shipped .d.ts
    static fromJSON(json: TokenizerJSON): Tokenizer;
  }

  export default Tokenizer;
}