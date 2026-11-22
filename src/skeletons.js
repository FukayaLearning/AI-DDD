import { generateGoSkeleton } from "./skeletons/go.js";
import { generatePythonSkeleton } from "./skeletons/python.js";
import { generateRustSkeleton } from "./skeletons/rust.js";
import { generateTypeScriptSkeleton } from "./skeletons/typescript.js";

export function generateSkeletonFiles(options) {
  const { lang } = options;
  switch (lang) {
    case "typescript":
      return generateTypeScriptSkeleton(options);
    case "python":
      return generatePythonSkeleton(options);
    case "go":
      return generateGoSkeleton(options);
    case "rust":
      return generateRustSkeleton(options);
    default:
      throw new Error(`Unsupported language: ${lang}`);
  }
}
