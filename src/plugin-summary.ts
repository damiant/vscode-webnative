export interface PluginSummary {
  plugins: Plugin[];
}

export interface Plugin {
  name: string;
  version: string;
  success: string[];
  repo?: string;
  keywords?: string[];
  fails: string[];
  description?: string;
  quality?: number;
  versions: string[];
  author: any;
  bugs?: string;
  published: string;
  downloads?: number;
  stars?: number;
  image?: string;
  updated?: string;
  fork?: boolean;
  license?: string;
}
