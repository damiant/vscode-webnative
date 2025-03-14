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
  platforms: string[];
  author: any;
  bugs?: string;
  published: string;
  downloads?: number;
  stars?: number;
  image?: string;
  updated?: string;
  license: string;
  title: string; // Calculated
  rating: number; // Calculated
  ratingInfo: string; // Calculated
  tagInfo: string; // Calcuilated
  dailyDownloads: string; // Calculated
  changed: string; // Calculated
  installed: string; // Calculated: whether the plugin is installed in the current project
  framework: string | undefined; // Calculated: either capacitor or cordova
  moreInfoUrl: string; // Calculated
  singlePlatform: string | undefined; // Calculated: either android or apple
}

export interface PluginInfo {
  name: string;
  version: string;
  latest: string;
}
