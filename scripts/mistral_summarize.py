#!/usr/bin/env python3
"""
Offline Mistral-7B summarization using ONNX Runtime.
Uses microsoft/mistral-7b-instruct-v0.2-ONNX with optimum.

Setup:
  pip install transformers torch optimum onnxruntime

Usage:
  python scripts/mistral_summarize.py <text_to_summarize>
"""

import sys
import json


def summarize_with_mistral(text: str) -> str:
    """Load Mistral ONNX locally and summarize text."""
    try:
        from transformers import AutoTokenizer, pipeline
        from optimum.onnxruntime import ORTModelForCausalLM
    except ImportError as e:
        return json.dumps({
            "error": f"Missing dependency: {e}. Install with: pip install transformers torch optimum onnxruntime"
        })

    try:
        model_id = "microsoft/mistral-7b-instruct-v0.2-ONNX"
        subfolder = "onnx/cpu_and_mobile/mistral-7b-instruct-v0.2-cpu-int4-rtn-block-32-acc-level-4"
        
        print(f"Loading ONNX model from {model_id}...", file=sys.stderr)
        
        # Load model with ONNX Runtime
        model = ORTModelForCausalLM.from_pretrained(
            model_id,
            subfolder=subfolder,
            file_name="mistral-7b-instruct-v0.2-cpu-int4-rtn-block-32-acc-level-4.onnx",
            use_io_binding=True
        )

        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            model_id,
            subfolder=subfolder
        )

        # Create pipeline
        pipe = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer
        )

        # Create prompt
        prompt = f"""<s>[INST] You are an expert summarization assistant. Summarize the following text concisely in the same language. 
Return only the summary without any introductory phrases.

Text to summarize:
{text}
[/INST]"""

        print("Running Mistral 7B ONNX summarization...", file=sys.stderr)
        
        # Generate summary
        result = pipe(
            prompt,
            max_new_tokens=150,
            do_sample=True,
            temperature=0.3,
            top_k=50,
            top_p=0.9,
            num_return_sequences=1
        )

        # Extract summary from result
        summary = result[0]["generated_text"]
        
        # Remove the prompt part
        summary = summary.split("[/INST]")[-1].strip()

        return json.dumps({"summary": summary})

    except Exception as e:
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python mistral_summarize.py <text>")
        sys.exit(1)

    text = sys.argv[1]
    result = summarize_with_mistral(text)
    print(result)

