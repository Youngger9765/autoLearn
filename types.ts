export interface Question {
  question_text: string;
  options: string[];
}

export interface Section {
  id: number;
  title: string;
  content: string;
  youtube_url: string;
  questions: Question[];
}

export interface Course {
  title: string;
  sections: Section[];
} 