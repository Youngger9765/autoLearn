describe('課程產生流程', () => {
  it('使用者可以產生課程', () => {
    cy.visit('http://localhost:3000/generate');
    cy.get('textarea[placeholder="請輸入你想學習的主題或需求描述..."]').type('Python 入門');
    cy.contains('開始產生課程').click();
    cy.contains('產生中').should('exist');
    // 根據實際 UI 調整下方斷言
    // cy.contains('課程產生完成').should('exist');
  });
}); 