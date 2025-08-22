// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 


import { Answer } from "./answer";

export class Question {
  questionText: string;
  answers: Answer[];

}

export type QuestionType = 'multiChoice' | 'freeText' | 'trueFalse' | 'singleAnswer';     // CHANGELOG 2025-08-15 by 邱语堂: 新增题型（暂时没有在其他地方用到）