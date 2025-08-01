/**
 * Type declarations for importing text files
 */

declare module "*.txt" {
  const content: string;
  export default content;
}