# OpenAI Module Prompting

An Express.js API service for text summarization using OpenAI's API.

## Overview

This project provides a simple REST API endpoint that accepts text input and returns AI-generated summaries with bullet points and keywords using OpenAI's language models.

## Features

- **Text Summarization**: POST endpoint that summarizes provided text
- **Structured Output**: Returns 3 bullet points (max 18 words each) and extracted keywords
- **Error Handling**: Validates input and provides meaningful error messages
- **Environment Configuration**: Uses dotenv for secure API key management

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd openai-module-prompting
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled application
- `npm run dev` - Run the application in development mode with ts-node

## Usage

### Start the server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

The API will be available at `http://localhost:3000`

### API Endpoint

**POST** `/summarize`

Request body:
```json
{
  "text": "Your text to summarize here..."
}
```

Response:
```json
{
  "summary": "• First key point\n• Second key point\n• Third key point\nKeywords: keyword1, keyword2, keyword3"
}
```

### Example

```bash
curl -X POST http://localhost:3000/summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "Your long text to summarize..."}'
```

## Configuration

### Code Formatting & Linting

- **Prettier** (`.prettierrc`) - Code formatter with 4-space indentation
- **ESLint** (`.eslintrc.json`) - Code linter with TypeScript support
- **EditorConfig** (`.editorconfig`) - Editor settings for consistent formatting

## Project Structure

```
.
├── src/
│   └── app.ts           # Main application file
├── dist/                # Compiled JavaScript output
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── .prettierrc           # Prettier configuration
├── .eslintrc.json       # ESLint configuration
├── .editorconfig        # EditorConfig settings
└── README.md            # This file
```

## Development

The project uses TypeScript for type safety. All source files are in the `src/` directory and are compiled to the `dist/` directory.

### Building

```bash
npm run build
```

This will compile TypeScript files and generate:
- JavaScript files (`.js`)
- Declaration files (`.d.ts`)
- Source maps (`.js.map`, `.d.ts.map`)

## Error Handling

The API validates input and returns appropriate error responses:

- **400 Bad Request**: When text is missing, not a string, or less than 10 characters
- **500 Internal Server Error**: When the OpenAI API request fails

## License

MIT

