# Testing Visual Attachment Analysis

This directory contains scripts to test the visual attachment analysis functionality.

## Prerequisites

1. Make sure your `.env` file is configured with your LLM API credentials:
   ```env
   LLM_API_HOST=https://your-api-host.com/api
   LLM_API_KEY=your-api-key-here
   LLM_MODEL=mistralai/mistral-small-3.2-24b-instruct
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

## Running Tests

### Test with a public image URL

```bash
# Test with a simple image
npx tsx scripts/test-vision/test-image-analysis.ts "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png"

# Test with a message for context
npx tsx scripts/test-vision/test-image-analysis.ts "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png" "What do you see in this image?"
```

### Test with multiple images

```bash
npx tsx scripts/test-vision/test-image-analysis.ts \
  "https://example.com/image1.png" \
  "https://example.com/image2.png" \
  "Compare these two images"
```

### Test with a data URL (base64 encoded image)

If you have a local image, you can convert it to a data URL:

```bash
# Convert local image to base64 (macOS/Linux)
base64 -i your-image.png | awk '{print "data:image/png;base64," $0}' > image-dataurl.txt

# Then use it in the test
npx tsx scripts/test-vision/test-image-analysis.ts "$(cat image-dataurl.txt)"
```

## Example Public Image URLs for Testing

You can use these URLs for testing (replace with actual working URLs):

- **Test image 1**: `https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png`
- **Test image 2**: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Red_Kitten_01.jpg/320px-Red_Kitten_01.jpg`

## Troubleshooting

### "Configuration error"
- Check that your `.env` file exists and contains the correct API credentials
- Verify that `LLM_API_HOST` and `LLM_API_KEY` are set correctly

### "Failed after 3 attempts"
- Check your internet connection
- Verify that your API key is valid and has not expired
- Check that the API host URL is correct and accessible

### "analysis_not_available"
- The model might not support vision/image analysis
- Try configuring a vision-capable model like GPT-4 Vision
- Update your `.env`:
  ```env
  LLM_VISION_MODEL=gpt-4-vision-preview
  ```

### "Request timeout"
- The image might be too large
- Try with a smaller image
- Increase the timeout in `llm-config.ts` if needed

## Expected Output

When successful, you should see:

```
============================================================
Testing Visual Attachment Analysis
============================================================

Image URLs: 1
  [1] https://example.com/image.png

User message: "What do you see?"

------------------------------------------------------------
Sending request to LLM...
------------------------------------------------------------

============================================================
RESULT
============================================================
Status: analyzed
Duration: 3456ms

Analyzable attachments: 1
Ignored attachments: 0

--- Analysis Output ---
{
  "description": "A transparent PNG image showing...",
  "extractedText": "",
  "objects": ["cube", "checkered pattern"],
  "context": "demonstration of PNG transparency",
  "issues": [],
  "confidence": "high"
}

============================================================
✅ SUCCESS: Image was analyzed successfully!
```
