const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

class Transcriber {
  static instance = null;
  static modelId = 'onnx-community/whisper-large-v3-turbo'; 

  static async getInstance(progressCallback) {
    if (!this.instance) {
      this.instance = await pipeline('automatic-speech-recognition', this.modelId, {
        device: 'webgpu',
        dtype: 'q4f16', 
        progress_callback: progressCallback,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audio } = event.data;

  if (type === 'transcribe') {
    try {
      // Run a short, cheap transcription on the first few seconds to detect language
      // before running the large Whisper model. This avoids downloading/running
      // the big model when we can route Whisper with a detected language.
      let detected = null;
      try {
        // Quick small transcriber for first N seconds
        // const QuickTranscriber = {
        //   instance: null,
        //   modelId: 'onnx-community/whisper-small',
        //   async getInstance() {
        //     if (!this.instance) {
        //       this.instance = await pipeline('automatic-speech-recognition', this.modelId, {
        //         device: 'webgpu', dtype: 'q4f16'
        //       });
        //     }
        //     return this.instance;
        //   }
        // };

        // const quick = await QuickTranscriber.getInstance();
        // assume 16000Hz sample rate for snippet length (match main thread)
        // const sampleRate = 16000;
        // const snippetSeconds = 5;
        // const snippetLen = Math.min(audio.length, sampleRate * snippetSeconds);
        // const audioSnippet = audio.slice(0, snippetLen);

        // Quick transcription (no need for timestamps)
        // const quickOut = await quick(audioSnippet, { chunk_length_s: snippetSeconds, language: null, task: 'transcribe' });
        // const textSnippet = quickOut?.text || (quickOut?.chunks && quickOut.chunks.map(c=>c.text).join(' ')) || '';

        // if (textSnippet) {
          try {
            const LangId = {
              instance: null,
              // modelId: 'qmaru/language_detection',
              async getInstance() {
                if (!this.instance) {
                  this.instance = await pipeline('audio-classification', 'Xenova/mms-lid-256', {
                    device: 'webgpu',
                    dtype: 'q4'
                  });
                }
                return this.instance;
              }
            };

            const lid = await LangId.getInstance();
            const lidRes = await lid(audio);
            let rawLabel = null;
            if (Array.isArray(lidRes) && lidRes.length > 0) rawLabel = lidRes[0].label || null;
            else if (lidRes && lidRes.label) rawLabel = lidRes.label;

            // const mapLabelToISO = (label) => {
            //   if (!label) return null;
            //   const l = String(label).trim().toLowerCase();
            //   const map = {
            //     english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it', portuguese: 'pt', russian: 'ru', chinese: 'zh', japanese: 'ja', korean: 'ko', arabic: 'ar', hebrew: 'he', hindi: 'hi', dutch: 'nl', swedish: 'sv', norwegian: 'no', danish: 'da', finnish: 'fi', polish: 'pl', czech: 'cs', turkish: 'tr', vietnamese: 'vi', indonesian: 'id', thai: 'th', greek: 'el', romanian: 'ro', hungarian: 'hu', ukrainian: 'uk', bulgarian: 'bg', serbian: 'sr', croatian: 'hr', slovak: 'sk', slovenian: 'sl', lithuanian: 'lt', latvian: 'lv', estonian: 'et', malay: 'ms', bengali: 'bn', tamil: 'ta', telugu: 'te', kannada: 'kn', malayalam: 'ml', marathi: 'mr', urdu: 'ur', persian: 'fa'
            //   };
            //   if (map[l]) return map[l];
            //   // If label already looks like an ISO code
            //   if (/^[a-z]{2,3}$/.test(l)) return l;
            //   // Some LID models return labels like 'LABEL_0' — can't map reliably
            //   return null;
            // };

            if (rawLabel) {
              // const mapped = mapLabelToISO(rawLabel);
              detected = rawLabel.slice(0,2) || null;
            }
          } catch (e) {
            console.warn('LID failed', e);
          }
        //}
      } catch (e) {
        console.warn('Quick transcribe failed', e);
       }

      // Now instantiate the large transcriber and run full transcription with language hint (if detected)
      const transcriber = await Transcriber.getInstance((data) => {
        self.postMessage({ type: 'progress', data });
      });

      self.postMessage({ type: 'start' });
      const output = await transcriber(audio, {
        chunk_length_s: 20,
        language: detected || null,
      });

      self.postMessage({ 
        type: 'complete', 
        text: output.text,
        chunks: output.chunks,
        detectedLanguage: detected || output.language || (output.chunks && output.chunks[0] && output.chunks[0].language) || null
      });

    } catch (err) {
      console.error('Worker Error:', err);
      self.postMessage({ type: 'error', error: err.message });
    }
  }
});
`;