// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { MultiChoice, FreeText, TrueFalse, SingleAnswer } from "../../../../../ui/src/graphql/API";

export class Response {
  questions: (MultiChoice | FreeText | TrueFalse | SingleAnswer)[];
}