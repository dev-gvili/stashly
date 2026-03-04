import {
  Florence2ForConditionalGeneration,
  AutoProcessor,
  load_image,
} from '@huggingface/transformers'
import { formatSize } from './formaters'
// import { getVision, getPipeline, type TranscribeOptions } from './ai.utils'
// import {
//   toVector,
//   cleanText,
//   type ItemForSearchEmbedding,
//   type ExtendedItem,
//   mapItemToSearch,
//   buildSearchTextFromItem,
// } from './search/embeddings'
// import { transcribeMedia } from './ai'
// import { APIError } from 'better-auth'
// import { StashlyError, StashlyErrorCode } from './api.errors'
// import {
//   AutoModelForCausalLM,
//   AutoTokenizer,
//   TextStreamer,
// } from '@huggingface/transformers'
// export interface TranscribeProps extends TranscribeOptions {
//   /** If true, yields text segments as they are generated. */
//   stream?: boolean
//   /** Optional callback for streaming or logging progress */
// }

/**
 * Acehnese (Arabic script) | ace_Arab
Acehnese (Latin script) | ace_Latn
Mesopotamian Arabic | acm_Arab
Ta’izzi-Adeni Arabic | acq_Arab
Tunisian Arabic | aeb_Arab
Afrikaans | afr_Latn
South Levantine Arabic | ajp_Arab
Akan | aka_Latn
Amharic | amh_Ethi
North Levantine Arabic | apc_Arab
Modern Standard Arabic | arb_Arab
Modern Standard Arabic (Romanized) | arb_Latn
Najdi Arabic | ars_Arab
Moroccan Arabic | ary_Arab
Egyptian Arabic | arz_Arab
Assamese | asm_Beng
Asturian | ast_Latn
Awadhi | awa_Deva
Central Aymara | ayr_Latn
South Azerbaijani | azb_Arab
North Azerbaijani | azj_Latn
Bashkir | bak_Cyrl
Bambara | bam_Latn
Balinese | ban_Latn
Belarusian | bel_Cyrl
Bemba | bem_Latn
Bengali | ben_Beng
Bhojpuri | bho_Deva
Banjar (Arabic script) | bjn_Arab
Banjar (Latin script) | bjn_Latn
Standard Tibetan | bod_Tibt
Bosnian | bos_Latn
Buginese | bug_Latn
Bulgarian | bul_Cyrl
Catalan | cat_Latn
Cebuano | ceb_Latn
Czech | ces_Latn
Chokwe | cjk_Latn
Central Kurdish | ckb_Arab
Crimean Tatar | crh_Latn
Welsh | cym_Latn
Danish | dan_Latn
German | deu_Latn
Southwestern Dinka | dik_Latn
Dyula | dyu_Latn
Dzongkha | dzo_Tibt
Greek | ell_Grek
English | eng_Latn
Esperanto | epo_Latn
Estonian | est_Latn
Basque | eus_Latn
Ewe | ewe_Latn
Faroese | fao_Latn
Fijian | fij_Latn
Finnish | fin_Latn
Fon | fon_Latn
French | fra_Latn
Friulian | fur_Latn
Nigerian Fulfulde | fuv_Latn
Scottish Gaelic | gla_Latn
Irish | gle_Latn
Galician | glg_Latn
Guarani | grn_Latn
Gujarati | guj_Gujr
Haitian Creole | hat_Latn
Hausa | hau_Latn
Hebrew | heb_Hebr
Hindi | hin_Deva
Chhattisgarhi | hne_Deva
Croatian | hrv_Latn
Hungarian | hun_Latn
Armenian | hye_Armn
Igbo | ibo_Latn
Ilocano | ilo_Latn
Indonesian | ind_Latn
Icelandic | isl_Latn
Italian | ita_Latn
Javanese | jav_Latn
Japanese | jpn_Jpan
Kabyle | kab_Latn
Jingpho | kac_Latn
Kamba | kam_Latn
Kannada | kan_Knda
Kashmiri (Arabic script) | kas_Arab
Kashmiri (Devanagari script) | kas_Deva
Georgian | kat_Geor
Central Kanuri (Arabic script) | knc_Arab
Central Kanuri (Latin script) | knc_Latn
Kazakh | kaz_Cyrl
Kabiyè | kbp_Latn
Kabuverdianu | kea_Latn
Khmer | khm_Khmr
Kikuyu | kik_Latn
Kinyarwanda | kin_Latn
Kyrgyz | kir_Cyrl
Kimbundu | kmb_Latn
Northern Kurdish | kmr_Latn
Kikongo | kon_Latn
Korean | kor_Hang
Lao | lao_Laoo
Ligurian | lij_Latn
Limburgish | lim_Latn
Lingala | lin_Latn
Lithuanian | lit_Latn
Lombard | lmo_Latn
Latgalian | ltg_Latn
Luxembourgish | ltz_Latn
Luba-Kasai | lua_Latn
Ganda | lug_Latn
Luo | luo_Latn
Mizo | lus_Latn
Standard Latvian | lvs_Latn
Magahi | mag_Deva
Maithili | mai_Deva
Malayalam | mal_Mlym
Marathi | mar_Deva
Minangkabau (Arabic script) | min_Arab
Minangkabau (Latin script) | min_Latn
Macedonian | mkd_Cyrl
Plateau Malagasy | plt_Latn
Maltese | mlt_Latn
Meitei (Bengali script) | mni_Beng
Halh Mongolian | khk_Cyrl
Mossi | mos_Latn
Maori | mri_Latn
Burmese | mya_Mymr
Dutch | nld_Latn
Norwegian Nynorsk | nno_Latn
Norwegian Bokmål | nob_Latn
Nepali | npi_Deva
Northern Sotho | nso_Latn
Nuer | nus_Latn
Nyanja | nya_Latn
Occitan | oci_Latn
West Central Oromo | gaz_Latn
Odia | ory_Orya
Pangasinan | pag_Latn
Eastern Panjabi | pan_Guru
Papiamento | pap_Latn
Western Persian | pes_Arab
Polish | pol_Latn
Portuguese | por_Latn
Dari | prs_Arab
Southern Pashto | pbt_Arab
Ayacucho Quechua | quy_Latn
Romanian | ron_Latn
Rundi | run_Latn
Russian | rus_Cyrl
Sango | sag_Latn
Sanskrit | san_Deva
Santali | sat_Olck
Sicilian | scn_Latn
Shan | shn_Mymr
Sinhala | sin_Sinh
Slovak | slk_Latn
Slovenian | slv_Latn
Samoan | smo_Latn
Shona | sna_Latn
Sindhi | snd_Arab
Somali | som_Latn
Southern Sotho | sot_Latn
Spanish | spa_Latn
Tosk Albanian | als_Latn
Sardinian | srd_Latn
Serbian | srp_Cyrl
Swati | ssw_Latn
Sundanese | sun_Latn
Swedish | swe_Latn
Swahili | swh_Latn
Silesian | szl_Latn
Tamil | tam_Taml
Tatar | tat_Cyrl
Telugu | tel_Telu
Tajik | tgk_Cyrl
Tagalog | tgl_Latn
Thai | tha_Thai
Tigrinya | tir_Ethi
Tamasheq (Latin script) | taq_Latn
Tamasheq (Tifinagh script) | taq_Tfng
Tok Pisin | tpi_Latn
Tswana | tsn_Latn
Tsonga | tso_Latn
Turkmen | tuk_Latn
Tumbuka | tum_Latn
Turkish | tur_Latn
Twi | twi_Latn
Central Atlas Tamazight | tzm_Tfng
Uyghur | uig_Arab
Ukrainian | ukr_Cyrl
Umbundu | umb_Latn
Urdu | urd_Arab
Northern Uzbek | uzn_Latn
Venetian | vec_Latn
Vietnamese | vie_Latn
Waray | war_Latn
Wolof | wol_Latn
Xhosa | xho_Latn
Eastern Yiddish | ydd_Hebr
Yoruba | yor_Latn
Yue Chinese | yue_Hant
Chinese (Simplified) | zho_Hans
Chinese (Traditional) | zho_Hant
Standard Malay | zsm_Latn
Zulu | zul_Latn
 */
export type SupportedLanguage =
  | 'ace_Arab'
  | 'ace_Latn'
  | 'acm_Arab'
  | 'acq_Arab'
  | 'aeb_Arab'
  | 'afr_Latn'
  | 'ajp_Arab'
  | 'aka_Latn'
  | 'amh_Ethi'
  | 'apc_Arab'
  | 'arb_Arab'
  | 'ars_Arab'
  | 'ary_Arab'
  | 'arz_Arab'
  | 'asm_Beng'
  | 'ast_Latn'
  | 'awa_Deva'
  | 'ayr_Latn'
  | 'azb_Arab'
  | 'azj_Latn'
  | 'bak_Cyrl'
  | 'bam_Latn'
  | 'ban_Latn'
  | 'bel_Cyrl'
  | 'bem_Latn'
  | 'ben_Beng'
  | 'bho_Deva'
  | 'bjn_Arab'
  | 'bjn_Latn'
  | 'bod_Tibt'
  | 'bos_Latn'
  | 'bug_Latn'
  | 'bul_Cyrl'
  | 'cat_Latn'
  | 'ceb_Latn'
  | 'ces_Latn'
  | 'cjk_Latn'
  | 'ckb_Arab'
  | 'crh_Latn'
  | 'cym_Latn'
  | 'dan_Latn'
  | 'deu_Latn'
  | 'dik_Latn'
  | 'dyu_Latn'
  | 'dzo_Tibt'
  | 'ell_Grek'
  | 'eng_Latn'
  | 'epo_Latn'
  | 'est_Latn'
  | 'eus_Latn'
  | 'ewe_Latn'
  | 'fao_Latn'
  | 'pes_Arab'
  | 'fij_Latn'
  | 'fin_Latn'
  | 'fon_Latn'
  | 'fra_Latn'
  | 'fur_Latn'
  | 'fuv_Latn'
  | 'gla_Latn'
  | 'gle_Latn'
  | 'glg_Latn'
  | 'grn_Latn'
  | 'guj_Gujr'
  | 'hat_Latn'
  | 'hau_Latn'
  | 'heb_Hebr'
  | 'hin_Deva'
  | 'hne_Deva'
  | 'hrv_Latn'
  | 'hun_Latn'
  | 'hye_Armn'
  | 'ibo_Latn'
  | 'ilo_Latn'
  | 'ind_Latn'
  | 'isl_Latn'
  | 'ita_Latn'
  | 'jav_Latn'
  | 'jpn_Jpan'
  | 'kab_Latn'
  | 'kac_Latn'
  | 'kam_Latn'
  | 'kan_Knda'
  | 'kas_Arab'
  | 'kas_Deva'
  | 'kat_Geor'
  | 'knc_Arab'
  | 'knc_Latn'
  | 'kaz_Cyrl'
  | 'kbp_Latn'
  | 'kea_Latn'
  | 'khm_Khmr'
  | 'kik_Latn'
  | 'kin_Latn'
  | 'kir_Cyrl'
  | 'kmb_Latn'
  | 'kon_Latn'
  | 'kor_Hang'
  | 'kmr_Latn'
  | 'lao_Laoo'
  | 'lvs_Latn'
  | 'lij_Latn'
  | 'lim_Latn'
  | 'lin_Latn'
  | 'lit_Latn'
  | 'lmo_Latn'
  | 'ltg_Latn'
  | 'ltz_Latn'
  | 'lua_Latn'
  | 'lug_Latn'
  | 'luo_Latn'
  | 'lus_Latn'
  | 'mag_Deva'
  | 'mai_Deva'
  | 'mal_Mlym'
  | 'mar_Deva'
  | 'min_Latn'
  | 'mkd_Cyrl'
  | 'plt_Latn'
  | 'mlt_Latn'
  | 'mni_Beng'
  | 'khk_Cyrl'
  | 'mos_Latn'
  | 'mri_Latn'
  | 'zsm_Latn'
  | 'mya_Mymr'
  | 'nld_Latn'
  | 'nno_Latn'
  | 'nob_Latn'
  | 'npi_Deva'
  | 'nso_Latn'
  | 'nus_Latn'
  | 'nya_Latn'
  | 'oci_Latn'
  | 'gaz_Latn'
  | 'ory_Orya'
  | 'pag_Latn'
  | 'pan_Guru'
  | 'pap_Latn'
  | 'pol_Latn'
  | 'por_Latn'
  | 'prs_Arab'
  | 'pbt_Arab'
  | 'quy_Latn'
  | 'ron_Latn'
  | 'run_Latn'
  | 'rus_Cyrl'
  | 'sag_Latn'
  | 'san_Deva'
  | 'sat_Beng'
  | 'scn_Latn'
  | 'shn_Mymr'
  | 'sin_Sinh'
  | 'slk_Latn'
  | 'slv_Latn'
  | 'smo_Latn'
  | 'sna_Latn'
  | 'snd_Arab'
  | 'som_Latn'
  | 'sot_Latn'
  | 'spa_Latn'
  | 'als_Latn'
  | 'srd_Latn'
  | 'srp_Cyrl'
  | 'ssw_Latn'
  | 'sun_Latn'
  | 'swe_Latn'
  | 'swh_Latn'
  | 'szl_Latn'
  | 'tam_Taml'
  | 'tat_Cyrl'
  | 'tel_Telu'
  | 'tgk_Cyrl'
  | 'tgl_Latn'
  | 'tha_Thai'
  | 'tir_Ethi'
  | 'taq_Latn'
  | 'taq_Tfng'
  | 'tpi_Latn'
  | 'tsn_Latn'
  | 'tso_Latn'
  | 'tuk_Latn'
  | 'tum_Latn'
  | 'tur_Latn'
  | 'twi_Latn'
  | 'tzm_Tfng'
  | 'uig_Arab'
  | 'ukr_Cyrl'
  | 'umb_Latn'
  | 'urd_Arab'
  | 'uzn_Latn'
  | 'vec_Latn'
  | 'vie_Latn'
  | 'war_Latn'
  | 'wol_Latn'
  | 'xho_Latn'
  | 'ydd_Hebr'
  | 'yor_Latn'
  | 'yue_Hant'
  | 'zho_Hans'
  | 'zho_Hant'
  | 'zul_Latn'

// export async function getVision() {
//   if (!global.stashly_ai_vision) {
//     // const modelId = 'onnx-community/Florence-2-base-ft' // smaller model
//     const modelId = 'onnx-community/Florence-2-large-ft' // more capable model
//     // 01. load model and processor
//     let processor = await AutoProcessor.from_pretrained(modelId)
//     let model = await Florence2ForConditionalGeneration.from_pretrained(
//       modelId,
//       {
//         dtype: 'q8', // Use fp32 for better accuracy; fp16 can be used for lower memory usage,
//       }
//     )
//     // 02. cache in global variable
//     global.stashly_ai_vision = { model, processor }
//   }
//   // 03. return cached model
//   return global.stashly_ai_vision
// }
/**
 * LocalAIPipeline: The primary orchestrator for AI tasks.
 * Uses global singleton patterns to prevent memory leaks and redundant model loading.
 */
export class StashlyAI {
  /**
   * Core Translation Logic
   * Includes chunking because Translation models have hard token limits (~512).
   */
  // static async translate({
  //   text,
  //   model = 'Xenova/nllb-200-distilled-600M',
  //   // model = 'Xenova/nllb-200-1.3B',
  //   source = 'eng_Latn',
  //   target = 'heb_Hebr',
  // }: {
  //   text: string
  //   model?: string
  //   source?: SupportedLanguage
  //   target?: SupportedLanguage
  // }): Promise<string> {
  //   const pipe = await getPipeline('translation', model, 'fp32')
  //   // const chunks = this.toChunk(text, 512)
  //   // const results: string[] = []
  //   const output = (await pipe(text, {
  //     tgt_lang: target,
  //     src_lang: source,
  //   } as any)) as Array<{ translation_text: string }>

  //   // for (const chunk of chunks) {
  //   //   if (!chunk.trim()) continue
  //   //   const output = (await pipe(chunk, {
  //   //     tgt_lang: target,
  //   //     src_lang: source,
  //   //   } as any)) as Array<{ translation_text: string }>
  //   //   results.push(output[0]?.translation_text || '')
  //   // }
  //   return output[0]?.translation_text || ''
  // }

  /**
   * Helper: Naive chunking by punctuation to respect model token limits.
   */
  // private static toChunk(text: string, maxLength: number): string[] {
  //   const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
  //   const chunks: string[] = []
  //   let currentChunk = ''

  //   for (const sentence of sentences) {
  //     if ((currentChunk + sentence).length > maxLength) {
  //       chunks.push(currentChunk.trim())
  //       currentChunk = sentence
  //     } else {
  //       currentChunk += sentence
  //     }
  //   }
  //   if (currentChunk) chunks.push(currentChunk.trim())

  //   return chunks
  // }

  // static async summarizeText(text: string): Promise<string> {
  //   const modelId = 'LiquidAI/LFM2.5-1.2B-Instruct-ONNX'

  //   // Load model and tokenizer
  //   const tokenizer = await AutoTokenizer.from_pretrained(modelId)
  //   const model = await AutoModelForCausalLM.from_pretrained(modelId, {
  //     device: 'auto',
  //     dtype: 'q4f16', // or "fp16"
  //   })

  //   // Prepare input
  //   const messages = [{ role: 'user', content: `summarize this text: ${text}` }]
  //   const input = tokenizer.apply_chat_template(messages, {
  //     add_generation_prompt: true,
  //     return_dict: true,
  //   })

  //   // Generate with streaming
  //   const streamer = new TextStreamer(tokenizer, { skip_prompt: true })
  //   const output = await model.generate({
  //     ...input,
  //     max_new_tokens: 256,
  //     do_sample: false,
  //     streamer,
  //   })

  //   return tokenizer.decode(output[0], { skip_special_tokens: true })
  // }

  /**
   * Summarizes long text into a shorter version.
   * Includes automated text cleaning and smart chunking.
   */
  //   static async summarize(text: string): Promise<string> {
  //     try {
  //       const cleaned = cleanText(text)
  //       const summarizer = await getPipeline(
  //         'summarization',
  //         'onnx-community/text_summarization-ONNX',
  //         // 'onnx-community/Qwen3-1.7B-ONNX',
  //         'fp16',
  //         'cpu'
  //       )

  //       /**
  //        * Prompt updated for Mistral v0.3 Instruction format.
  //        * - Uses [INST] tags.
  //        * - Strict constraints to prevent meta-talk.
  //        * - Preserves people's names.
  //        */
  //       const mistralPrompt = `<s>[INST] You are a professional data extraction tool. Summarize the text below.
  // - Provide a neutral, third-person summary of the content.
  // - Include all people's names mentioned in the text.
  // - Do NOT start with "The text is", "This message", or "The speaker".
  // - Maximum 100 words.
  // - Use the same language as the input.
  // - Return ONLY the summary.
  // - Keep full sentences only.
  // - Avoid vague language; be specific.
  // - Prioritize clarity and conciseness.
  // - Maintain the source language of the input.

  // TEXT:
  // "${cleaned}" [/INST]`
  //       /**
  //        * IMPROVED PROMPT for Llama 3.2 Summarization
  //        * 1. Uses Llama-3-style header tags (<|begin_of_text|>, etc.)
  //        * 2. Reinforces preserving people's names.
  //        */
  //       // const prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
  //       const prompt = `You are a professional summarization assistant. Your ONLY task is to summarize text accurately and concisely.

  //       CRITICAL RULES:
  //       1. NEVER refuse or ask for clarification — summarize what is provided.
  //       2. NEVER invent, or hallucinate details not explicitly in the source text.
  //       3. NEVER add interpretations, opinions, or external knowledge.
  //       4. If information is ambiguous or unclear, state it as ambiguous.
  //       5. Preserve all proper nouns, technical terms, and names exactly as written.

  //       OUTPUT FORMAT:
  //       Generate ONLY the summary structured as follows:
  //       - For narrative/personal/emotional content: Use headers **SUMMARY**, **MAIN DETAILS**, **OUTCOME** (2-3 bullets max per section)
  //       - For technical/analytical content: Use headers **OVERVIEW**, **KEY POINTS**, **CONTEXT**, **CONCLUSION**
  //       - Use bullet points under each header (2-3 bullets max per section)
  //       - Ensure each section has 2-3 bullet points.
  //       - Maximum 120 words total
  //       - No metadata, no disclaimers, no explanatory preamble
  //       - Do NOT include the headers in the final output. If no content for a header, omit the header.
  //       - Do NOT include the prompt itself in the output.

  //       QUALITY STANDARDS:
  //       - Write in complete, grammatically correct sentences
  //       - Match the tone of the original text
  //       - Prioritize factual accuracy over conciseness
  //       Summarize this text. Preserve all names and details. Use the format specified above:

  //       ${cleaned}
  //       `

  //       const qwen3prompt = `Task: Produce an abstractive summary of the text below.
  // Length: 3–6 sentences or ~50–120 words.
  // Focus: Identify the main thesis, 2–4 supporting points, and any concrete outcomes or numbers. Omit minor examples and repetition.
  // Style: Neutral, concise, and readable for a general audience. Use full sentences and no bullet lists unless asked.
  // Text: ${cleaned}
  // `
  //       // <|eot_id|><|start_header_id|>user<|end_header_id|>
  //       // <|eot_id|><|start_header_id|>assistant<|end_header_id|>

  //       const flanT5Prompt = `summarize: ${cleaned}`
  //       const output = (await summarizer(cleaned, {
  //         max_new_tokens: 180,
  //         remove_invalid_values: true,
  //       })) as Array<{ summary_text: string }>

  //       return output[0]?.summary_text?.trim()
  //     } catch (err) {
  //       if (err instanceof APIError) {
  //         console.error('Summarization failed:', err)
  //         throw new StashlyError(
  //           StashlyErrorCode.AI_SUMMARIZATION_FAILED,
  //           err.message
  //         )
  //       } else {
  //         console.error(
  //           'Summarization failed with unknown error:',
  //           err,
  //           'Input text:',
  //           text
  //         )
  //         throw new StashlyError(
  //           StashlyErrorCode.AI_SUMMARIZATION_FAILED,
  //           'An unknown error occurred during summarization.'
  //         )
  //       }
  //     }
  //   }
  /**
   * Generates a detailed description of an image.
   * Uses Florence-2-Large for superior detail over standard CLIP/ViT models.
   */
  static async caption(
    url: string,
    detailLevel: 'short' | 'long' = 'long'
  ): Promise<string> {
    try {
      // const modelId = 'onnx-community/Florence-2-base-ft' // more capable model
      // // 01. load model and processor
      // const image = await RawImage.fromURL(url)
      // let processor = await AutoProcessor.from_pretrained(modelId)
      // let model = await Florence2ForConditionalGeneration.from_pretrained(
      //   modelId,
      //   {
      //     device: 'webgpu',
      //     dtype: 'q4f16', // Use fp32 for better accuracy; fp16 can be used for lower memory usage,
      //   }
      // )

      // const prompt =
      //   detailLevel === 'long'
      //     ? '<MORE_DETAILED_CAPTION>'
      //     : '<DETAILED_CAPTION>'

      // const inputs = await processor(image, prompt)

      // const output = await model.generate({
      //   ...inputs,
      //   max_new_tokens: 256,
      //   remove_invalid_values: true,
      //   length_penalty: 1.0,
      // })
      // // Handle the different output shapes Transformers.js might return
      // const outputIds =
      //   output instanceof Tensor ? output : (output as any).sequences

      // const caption = processor.batch_decode(outputIds, {
      //   skip_special_tokens: true,
      // })[0]
      // console.log('StashlyAI caption: ', caption)

      // return caption?.trim() || ''
      // Load model, processor, and tokenizer
      const model_id = 'onnx-community/Florence-2-base-ft'
      const model = await Florence2ForConditionalGeneration.from_pretrained(
        model_id,
        {
          device: 'webgpu',
          dtype: 'fp32',
          progress_callback: (props) => {
            if (props.status === 'initiate') {
              console.log(`Initiating download for ${props.file}`)
            }
            if (props.status === 'download') {
              console.log(`Downloading ${props.file}`)
            }
            if (props.status === 'progress') {
              console.log(
                `Download ${props.progress.toFixed(0)}% for ${props.file}: ${formatSize('byte', 'unit', props.loaded)}/${formatSize('byte', 'unit', props.total)}`
              )
            }
            if (props.status === 'done') {
              console.log(`Download complete for ${props.file}`)
            }
            if (props.status === 'ready') {
              console.log(`${props.model} is ready with task ${props.task}`)
            }
          },
        }
      )
      const processor = await AutoProcessor.from_pretrained(model_id)

      // Load image and prepare vision inputs
      const image = await load_image(url)

      // Specify task and prepare text inputs
      const task = '<MORE_DETAILED_CAPTION>'
      //@ts-ignore
      const prompts = processor.construct_prompts(task)

      // Pre-process the image and text inputs
      const inputs = await processor(image, prompts)

      // Generate text
      const generated_ids = await model.generate({
        ...inputs,
        max_new_tokens: 100,
      })

      // Decode generated text
      //@ts-ignore
      const generated_text = processor.batch_decode(generated_ids, {
        skip_special_tokens: true,
        skip_prompt: true,
      })[0]

      // Post-process the generated text
      //@ts-ignore
      const result = processor.post_process_generation(
        generated_text,
        task,
        image.size
      )
      console.log("result", result)
      console.log("model.sessions before dispose",model.sessions)
      await model.dispose() // Dispose of the model to free up memory
      console.log("model.sessions after dispose",model.sessions)
      return result['<MORE_DETAILED_CAPTION>']
    } catch (err) {
      console.error('Image captioning failed:', err)
      return ''
    }
  }

  // /**
  //  * Generates a 768-dimension vector embedding for semantic search.
  //  * Ensures the vector is normalized for cosine similarity.
  //  */
  // static async generateEmbedding(text: string): Promise<number[]> {
  //   const vector = await toVector(text)
  //   // Extract first vector if result is a batch
  //   return Array.isArray(vector[0])
  //     ? (vector[0] as number[])
  //     : (vector as number[])
  // }

  /**
   * 2. ENHANCED EMBEDDING LOGIC
   * This is what you were missing: it uses the logic from embeddings.ts
   * to create a "Semantic Fingerprint" of the entire database item.
   */
  // static async embedding(
  //   item: ItemForSearchEmbedding | ExtendedItem,
  //   options?: { boostName?: number; includeDates?: boolean }
  // ): Promise<number[]> {
  //   // 1. If it's a full Prisma item, map it to our searchable interface
  //   const searchData =
  //     (item as any).name && (item as any).status
  //       ? mapItemToSearch(item as ExtendedItem)
  //       : (item as ItemForSearchEmbedding)

  //   // 2. Build the structured natural language string (e.g. "Name. Name. Category. Tags. Summary.")
  //   const searchString = buildSearchTextFromItem(searchData, options)

  //   // 3. Convert that rich string into a vector
  //   const vector = await toVector(searchString)
  //   return Array.isArray(vector[0])
  //     ? (vector[0] as number[])
  //     : (vector as number[])
  // }
  // LiquidAI/LFM2-2.6B-Transcript-ONNX is also a good model for transcription, but it seems to have some issues with streaming outputs in Transformers.js. The "Xenova/nllb-200-distilled-600M" model is more stable for our current use case, even if it's not specifically designed for transcription. We can explore better transcription models in the future as the ecosystem matures.
  /**
   * Transcribes audio or video from a given URL.
   * Currently non-streaming; returns full text after processing.
   */
  // static async transcribe(
  //   props: TranscribeProps = {
  //     url: '',
  //     stream: false, // Default to non-streaming
  //     model: 'large-v3-turbo', // Default model for transcription
  //     queue: 10, // Default concurrency
  //     language: 'auto', // Default language detection
  //   }
  // ) {
  //   /**
  //    * NOTE: The transcribeMedia function is designed to handle both streaming and non-streaming transcription.
  //    * - If props.stream is true, it will yield text segments as they are generated.
  //    * - If props.stream is false, it will return the full transcription after processing.
  //    * In this wrapper, we currently only support the non-streaming use case for simplicity. Streaming would require a different handling approach (e.g., using async generators or callbacks).
  //    * For streaming support, we would need to refactor this method to return an async generator or accept a callback for each segment.
  //    * Example of streaming usage:
  //    * @example
  //    * ```
  //    * for await (const segment of StashlyAI.transcribe({ url, stream: true })) {
  //    *  console.log('New segment:', segment);
  //    * }
  //    * ```
  //    * For now, we will just call transcribeMedia with streaming disabled and return the full text.
  //    *
  //    * This allows us to keep the interface simple while still leveraging the powerful transcription capabilities of transcribeMedia. We can always add streaming support in the future if needed.
  //    *
  //    */
  //   let fullText = await transcribeMedia(props)
  //   return fullText
  // }
  /**
   * Complete Audio Processing Pipeline:
   * 1. Transcribe -> 2. Summarize -> 3. Embed
   */
  // static async processAudio(url: string) {
  //   let transcription = await this.transcribe({ url })
  //   const isHebrew = /[\u0590-\u05FF]/.test(transcription)
  //   let summarization: string
  //   let summary: string
  //   if (isHebrew) {
  //     let translation = await this.translate({
  //       text: transcription,
  //       source: 'heb_Hebr',
  //       target: 'eng_Latn',
  //     })
  //     summarization = await this.summarize(translation)
  //     console.log('Summarization:', summarization)
  //     summary = await this.translate({
  //       text: summarization,
  //       source: 'eng_Latn',
  //       target: 'heb_Hebr',
  //     })
  //     console.log('Summary:', summary)
  //   } else {
  //     summarization = await this.summarize(transcription)
  //     summary = summarization
  //   }
  //   return {
  //     transcription,
  //     summary,
  //   }
  // }

  /**
   * Complete Image Processing Pipeline:
   * 1. Describe -> 2. Embed
   */
  static async processImage(url: string) {
    const description = await this.caption(url)
    // TODO: generate embedding for the description ( image caption )
    return {
      description,
    }
  }
}
