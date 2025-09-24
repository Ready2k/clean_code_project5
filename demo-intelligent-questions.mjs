// Demonstration of the improved intelligent question generation

import { IntelligentQuestionGeneratorImpl } from './src/services/intelligent-question-generator.js';

const generator = new IntelligentQuestionGeneratorImpl();

// Example scenarios to demonstrate the improvement
const scenarios = [
  {
    name: "Self-contained explanation task",
    humanPrompt: {
      goal: "Explain how photosynthesis works in plants",
      audience: "High school students",
      steps: [
        "Describe the process of light absorption by chlorophyll",
        "Explain the conversion of CO2 and water into glucose",
        "Detail the production of oxygen as a byproduct",
        "Summarize the overall chemical equation"
      ],
      output_expectations: {
        format: "educational explanation",
        fields: ["process_steps", "chemical_equation", "importance"]
      }
    }
  },
  {
    name: "Vague analysis task requiring input",
    humanPrompt: {
      goal: "Analyze customer feedback data",
      audience: "Product managers",
      steps: [
        "Review the feedback",
        "Identify patterns"
      ],
      output_expectations: {
        format: "report",
        fields: ["insights"]
      }
    }
  },
  {
    name: "Code generation task",
    humanPrompt: {
      goal: "Write a function to sort an array",
      audience: "Developers",
      steps: [
        "Create the function",
        "Implement sorting logic"
      ],
      output_expectations: {
        format: "code",
        fields: ["function"]
      }
    }
  },
  {
    name: "Content generation with specific requirements",
    humanPrompt: {
      goal: "Generate a professional email template for customer onboarding",
      audience: "Customer success team",
      steps: [
        "Create a welcoming subject line",
        "Write personalized greeting",
        "Include key onboarding steps",
        "Add contact information and next steps"
      ],
      output_expectations: {
        format: "email template",
        fields: ["subject", "greeting", "body", "signature"]
      }
    }
  }
];

console.log("🚀 Intelligent Question Generation Demo\n");
console.log("This demonstrates how the AI enhancer now generates context-aware questions");
console.log("instead of always asking the same generic questions.\n");

for (const scenario of scenarios) {
  console.log(`📋 Scenario: ${scenario.name}`);
  console.log(`Goal: "${scenario.humanPrompt.goal}"`);
  
  // Detect task type
  const taskType = generator.detectTaskType(scenario.humanPrompt);
  console.log(`🎯 Detected task type: ${taskType}`);
  
  // Check if questions should be generated
  const shouldGenerate = generator.shouldGenerateQuestions({
    humanPrompt: scenario.humanPrompt,
    taskType
  });
  
  console.log(`❓ Should generate questions: ${shouldGenerate}`);
  
  if (shouldGenerate) {
    // Generate questions
    const questions = await generator.generateQuestions({
      humanPrompt: scenario.humanPrompt,
      taskType
    });
    
    if (questions.length > 0) {
      console.log(`📝 Generated ${questions.length} intelligent question(s):`);
      questions.forEach((q, i) => {
        console.log(`   ${i + 1}. ${q.text}`);
        if (q.help_text) {
          console.log(`      💡 ${q.help_text}`);
        }
      });
    } else {
      console.log("✅ No questions needed - prompt is already complete");
    }
  } else {
    console.log("✅ No questions needed - task is self-contained");
  }
  
  console.log("─".repeat(60));
}

console.log("\n🎉 Key Improvements:");
console.log("• Context-aware question generation based on task type");
console.log("• No questions for self-contained tasks (like explanations)");
console.log("• Task-specific questions (e.g., programming language for code tasks)");
console.log("• Intelligent detection of when additional input is actually needed");
console.log("• Elimination of generic 'What data?' and 'Any constraints?' questions");

console.log("\n🔧 Before: Always asked the same 2 generic questions");
console.log("🎯 After: Smart, contextual questions only when needed");