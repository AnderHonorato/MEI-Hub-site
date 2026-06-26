const { lerBanco, escreverBanco } = require('./banco');

(async () => {
  const db = await lerBanco();
  await escreverBanco(db);
  console.log('Seed concluido. Usuarios iniciais:');
  console.log('Founder/Owner: owner@meinocontrole.local / Owner@123456!');
  console.log('Suporte: suporte@meinocontrole.local / Suporte@123456!');
  console.log('Moderacao: moderacao@meinocontrole.local / Moderacao@123456!');
  process.exit(0);
})();
