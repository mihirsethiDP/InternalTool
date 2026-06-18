import { describe, it, expect } from 'vitest';
import { conversationalReply } from '../chatIntent';

describe('conversationalReply', () => {
  it('responds to greetings', () => {
    expect(conversationalReply('hi')).toBeTruthy();
    expect(conversationalReply('Hello!')).toBeTruthy();
    expect(conversationalReply('good morning')).toBeTruthy();
  });

  it('responds to thanks / acknowledgements', () => {
    expect(conversationalReply('thanks')).toBeTruthy();
    expect(conversationalReply('Got it')).toBeTruthy();
    expect(conversationalReply('ok')).toBeTruthy();
  });

  it('responds to "move on" / meta', () => {
    expect(conversationalReply('Can we move on another issue')).toBeTruthy();
    expect(conversationalReply('next question')).toBeTruthy();
    expect(conversationalReply('never mind')).toBeTruthy();
  });

  it('responds to farewells and capability questions', () => {
    expect(conversationalReply('bye')).toBeTruthy();
    expect(conversationalReply('what can you do')).toBeTruthy();
  });

  it('does NOT catch real sensor queries', () => {
    expect(conversationalReply('pH drifting')).toBeNull();
    expect(conversationalReply('How do I clean the EC probe?')).toBeNull();
    expect(conversationalReply('UPCS-MAG-110 empty pipe error')).toBeNull();
    expect(conversationalReply('flow meter shows zero')).toBeNull();
    // a query that merely starts with a stop-ish word but is a real question
    expect(conversationalReply('ok the pH reading is drifting')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(conversationalReply('')).toBeNull();
    expect(conversationalReply('   ')).toBeNull();
  });
});
