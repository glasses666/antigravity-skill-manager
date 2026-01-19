/**
 * Skill metadata and structure types
 */

export interface SkillMetadata {
    name: string;
    description: string;
}

export interface LocalSkill {
    name: string;
    path: string;
    metadata: SkillMetadata;
    hasScripts: boolean;
    hasData: boolean;
    hasExamples: boolean;
}

export interface GitHubSkill {
    name: string;
    repoOwner: string;
    repoName: string;
    path: string;  // path within repo, e.g., "skills/art-styles"
    description: string;
    url: string;
    stars?: number;
    updatedAt?: string;
    verified: boolean;  // has valid SKILL.md
}

export interface CommunitySkill {
    name: string;
    repoUrl: string;
    description: string;
    stars: number;
    forks: number;
    updatedAt: string;
    topics: string[];
    verified: boolean;
    category?: SkillCategory;
}

export type SkillCategory =
    | 'development'
    | 'design'
    | 'security'
    | 'document'
    | 'testing'
    | 'automation'
    | 'other';

export interface SkillFilter {
    keywords?: string[];
    categories?: SkillCategory[];
    topics?: string[];
    source?: ('official' | 'community' | 'personal')[];
    minStars?: number;
    updatedWithin?: '1week' | '1month' | '3months' | '1year';
    verifiedOnly?: boolean;
}

export interface GitHubRepoContent {
    name: string;
    path: string;
    type: 'file' | 'dir';
    download_url?: string;
}

export interface GitHubSearchResult {
    total_count: number;
    items: GitHubRepo[];
}

export interface GitHubRepo {
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    updated_at: string;
    topics: string[];
    owner: {
        login: string;
    };
}
