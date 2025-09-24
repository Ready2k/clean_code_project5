// In-memory implementation of AnswerStorage for testing and simple usage

import { Answer } from '../models/variable';
import { AnswerStorage } from './variable-manager';

export class MemoryAnswerStorage implements AnswerStorage {
  private answers: Map<string, Answer> = new Map();

  async saveAnswer(answer: Answer): Promise<void> {
    this.answers.set(answer.id, { ...answer });
  }

  async getAnswers(questionIds: string[]): Promise<Answer[]> {
    const results: Answer[] = [];
    
    for (const answer of this.answers.values()) {
      if (questionIds.includes(answer.question_id)) {
        results.push({ ...answer });
      }
    }
    
    return results;
  }

  async getAnswersByUser(userId: string): Promise<Answer[]> {
    const results: Answer[] = [];
    
    for (const answer of this.answers.values()) {
      if (answer.user_id === userId) {
        // Note: We don't have direct access to promptId from Answer,
        // so this implementation assumes all answers for a user are relevant
        // In a real implementation, you'd join with questions to filter by promptId
        results.push({ ...answer });
      }
    }
    
    return results;
  }

  async deleteAnswer(answerId: string): Promise<void> {
    this.answers.delete(answerId);
  }

  async updateAnswer(answerId: string, value: any): Promise<void> {
    const answer = this.answers.get(answerId);
    if (answer) {
      answer.value = value;
      answer.created_at = new Date().toISOString(); // Update timestamp
      this.answers.set(answerId, answer);
    } else {
      throw new Error(`Answer with ID ${answerId} not found`);
    }
  }

  // Additional methods for testing
  clear(): void {
    this.answers.clear();
  }

  size(): number {
    return this.answers.size;
  }

  getAllAnswers(): Answer[] {
    return Array.from(this.answers.values()).map(a => ({ ...a }));
  }
}