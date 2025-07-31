/**
 * Bun plugin to handle .txt file imports during bundling
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

export const txtPlugin = {
  name: "txt-loader",
  setup(build) {
    // Handle .txt file imports
    build.onLoad({ filter: /\.txt$/ }, (args) => {
      try {
        // Read the .txt file content
        const text = readFileSync(args.path, 'utf8');
        
        // Return as ES module default export
        return {
          contents: `export default ${JSON.stringify(text)};`,
          loader: 'js'
        };
      } catch (error) {
        return {
          errors: [{
            text: `Failed to load .txt file: ${error.message}`,
            location: { file: args.path }
          }]
        };
      }
    });

    // Handle resolution of .txt files
    build.onResolve({ filter: /\.txt$/ }, (args) => {
      // Resolve relative to the importing file
      if (args.kind === 'import-statement' || args.kind === 'require-call') {
        const resolved = resolve(args.resolveDir, args.path);
        return {
          path: resolved,
          namespace: 'txt'
        };
      }
    });
  }
};