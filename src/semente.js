const { lerBanco, escreverBanco } = require('./banco');
const db = lerBanco();
escreverBanco(db);
console.log('Seed concluído. Usuários iniciais:');
console.log('Founder/Owner: owner@meinocontrole.local / Owner@123456!');
console.log('Suporte: suporte@meinocontrole.local / Suporte@123456!');
console.log('Moderação: moderacao@meinocontrole.local / Moderacao@123456!');
