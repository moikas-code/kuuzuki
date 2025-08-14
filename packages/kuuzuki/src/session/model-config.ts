/**
 * Model-specific configurations and optimizations
 * 
 * This module provides model-specific configurations for different AI providers
 * and models, including prompt selection, tool compatibility, and performance
 * optimizations.
 */

export interface ModelConfig {
  /** Model-specific prompt optimizations */
  promptOptimizations: {
    /** Maximum context length for the model */
    maxContextLength?: number;
    /** Preferred response format */
    responseFormat?: "concise" | "detailed" | "structured";
    /** Tool usage strategy */
    toolStrategy?: "parallel" | "sequential" | "minimal";
  };
  
  /** Tool compatibility settings */
  toolCompatibility: {
    /** Tools that work well with this model */
    preferred: string[];
    /** Tools that should be avoided */
    avoided: string[];
    /** Tools that require special handling */
    special: Record<string, any>;
  };
  
  /** Performance optimizations */
  performance: {
    /** Recommended batch size for parallel operations */
    batchSize?: number;
    /** Timeout adjustments */
    timeoutMultiplier?: number;
    /** Memory usage optimizations */
    memoryOptimized?: boolean;
  };
}

export const MODEL_CONFIGURATIONS: Record<string, ModelConfig> = {
  // GPT-5 and Copilot models
  "gpt-5": {
    promptOptimizations: {
      maxContextLength: 200000,
      responseFormat: "concise",
      toolStrategy: "parallel",
    },
    toolCompatibility: {
      preferred: ["bash", "edit", "read", "write", "grep", "glob", "todowrite", "todoread"],
      avoided: [],
      special: {},
    },
    performance: {
      batchSize: 5,
      timeoutMultiplier: 1.0,
      memoryOptimized: false,
    },
  },
  
  "copilot": {
    promptOptimizations: {
      maxContextLength: 150000,
      responseFormat: "concise",
      toolStrategy: "parallel",
    },
    toolCompatibility: {
      preferred: ["bash", "edit", "read", "write", "grep", "glob", "todowrite"],
      avoided: ["patch"],
      special: {},
    },
    performance: {
      batchSize: 4,
      timeoutMultiplier: 1.2,
      memoryOptimized: true,
    },
  },
  
  // O1 reasoning models
  "o1": {
    promptOptimizations: {
      maxContextLength: 100000,
      responseFormat: "structured",
      toolStrategy: "sequential",
    },
    toolCompatibility: {
      preferred: ["bash", "read", "write", "edit", "grep", "glob", "todowrite", "todoread"],
      avoided: [],
      special: {
        "todowrite": { "planningMode": true },
        "bash": { "explainCommands": true },
      },
    },
    performance: {
      batchSize: 2,
      timeoutMultiplier: 2.0,
      memoryOptimized: true,
    },
  },
  
  "o3": {
    promptOptimizations: {
      maxContextLength: 120000,
      responseFormat: "structured",
      toolStrategy: "sequential",
    },
    toolCompatibility: {
      preferred: ["bash", "read", "write", "edit", "grep", "glob", "todowrite", "todoread"],
      avoided: [],
      special: {
        "todowrite": { "planningMode": true },
        "bash": { "explainCommands": true },
      },
    },
    performance: {
      batchSize: 3,
      timeoutMultiplier: 1.8,
      memoryOptimized: true,
    },
  },
  
  // Claude models
  "claude": {
    promptOptimizations: {
      maxContextLength: 200000,
      responseFormat: "detailed",
      toolStrategy: "parallel",
    },
    toolCompatibility: {
      preferred: ["bash", "edit", "read", "write", "grep", "glob", "todowrite", "todoread"],
      avoided: ["patch"],
      special: {
        "edit": { "preferredOverPatch": true },
      },
    },
    performance: {
      batchSize: 4,
      timeoutMultiplier: 1.0,
      memoryOptimized: false,
    },
  },
  
  // Qwen models
  "qwen": {
    promptOptimizations: {
      maxContextLength: 80000,
      responseFormat: "concise",
      toolStrategy: "sequential",
    },
    toolCompatibility: {
      preferred: ["bash", "read", "write", "edit", "grep", "glob"],
      avoided: ["patch", "todowrite", "todoread", "task"],
      special: {
        "bash": { "simpleCommands": true },
      },
    },
    performance: {
      batchSize: 2,
      timeoutMultiplier: 1.5,
      memoryOptimized: true,
    },
  },
  
  // Gemini models
  "gemini": {
    promptOptimizations: {
      maxContextLength: 100000,
      responseFormat: "structured",
      toolStrategy: "parallel",
    },
    toolCompatibility: {
      preferred: ["bash", "read", "write", "edit", "grep", "glob"],
      avoided: ["patch", "task"],
      special: {
        "bash": { "avoidComplexPipes": true },
      },
    },
    performance: {
      batchSize: 3,
      timeoutMultiplier: 1.3,
      memoryOptimized: true,
    },
  },
  
  // GPT-4 and other GPT models
  "gpt-4": {
    promptOptimizations: {
      maxContextLength: 128000,
      responseFormat: "concise",
      toolStrategy: "parallel",
    },
    toolCompatibility: {
      preferred: ["bash", "edit", "read", "write", "grep", "glob", "todowrite", "todoread"],
      avoided: [],
      special: {},
    },
    performance: {
      batchSize: 4,
      timeoutMultiplier: 1.0,
      memoryOptimized: false,
    },
  },
  
  "gpt-3.5": {
    promptOptimizations: {
      maxContextLength: 16000,
      responseFormat: "concise",
      toolStrategy: "sequential",
    },
    toolCompatibility: {
      preferred: ["bash", "read", "write", "edit", "grep", "glob"],
      avoided: ["patch", "task", "todowrite", "todoread"],
      special: {},
    },
    performance: {
      batchSize: 2,
      timeoutMultiplier: 1.2,
      memoryOptimized: true,
    },
  },
};

/**
 * Get model configuration for a specific model ID
 */
export function getModelConfig(modelID: string): ModelConfig | null {
  const model = modelID.toLowerCase();
  
  // Direct match
  for (const [key, config] of Object.entries(MODEL_CONFIGURATIONS)) {
    if (model.includes(key)) {
      return config;
    }
  }
  
  return null;
}

/**
 * Get provider-specific optimizations
 */
export function getProviderOptimizations(providerID: string): Partial<ModelConfig> {
  const provider = providerID.toLowerCase();
  
  switch (provider) {
    case "openai":
      return {
        promptOptimizations: {
          toolStrategy: "parallel",
        },
        performance: {
          batchSize: 4,
          timeoutMultiplier: 1.0,
        },
      };
      
    case "anthropic":
      return {
        promptOptimizations: {
          responseFormat: "detailed",
          toolStrategy: "parallel",
        },
        toolCompatibility: {
          preferred: ["edit"],
          avoided: ["patch"],
          special: {},
        },
      };
      
    case "google":
      return {
        promptOptimizations: {
          toolStrategy: "sequential",
        },
        performance: {
          batchSize: 2,
          timeoutMultiplier: 1.5,
        },
      };
      
    default:
      return {};
  }
}

/**
 * Check if a tool is compatible with a specific model
 */
export function isToolCompatible(toolName: string, modelID: string, providerID: string): boolean {
  const modelConfig = getModelConfig(modelID);
  const providerConfig = getProviderOptimizations(providerID);
  
  // Check model-specific compatibility
  if (modelConfig) {
    if (modelConfig.toolCompatibility.avoided.includes(toolName)) {
      return false;
    }
    if (modelConfig.toolCompatibility.preferred.includes(toolName)) {
      return true;
    }
  }
  
  // Check provider-specific compatibility
  if (providerConfig.toolCompatibility) {
    if (providerConfig.toolCompatibility.avoided?.includes(toolName)) {
      return false;
    }
    if (providerConfig.toolCompatibility.preferred?.includes(toolName)) {
      return true;
    }
  }
  
  // Default to compatible
  return true;
}

/**
 * Get recommended batch size for parallel operations
 */
export function getRecommendedBatchSize(modelID: string, providerID: string): number {
  const modelConfig = getModelConfig(modelID);
  const providerConfig = getProviderOptimizations(providerID);
  
  return modelConfig?.performance.batchSize || 
         providerConfig.performance?.batchSize || 
         3; // Default batch size
}

/**
 * Get tool strategy for a specific model
 */
export function getToolStrategy(modelID: string, providerID: string): "parallel" | "sequential" | "minimal" {
  const modelConfig = getModelConfig(modelID);
  const providerConfig = getProviderOptimizations(providerID);
  
  return modelConfig?.promptOptimizations.toolStrategy || 
         providerConfig.promptOptimizations?.toolStrategy || 
         "parallel"; // Default strategy
}