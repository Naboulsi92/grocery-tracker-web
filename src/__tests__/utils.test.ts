describe('Sample test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle strings', () => {
    const name = 'Grocery Tracker';
    expect(name).toContain('Grocery');
  });
});