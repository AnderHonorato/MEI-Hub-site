function iniciarRevelarAoRolar(){
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => { if (entrada.isIntersecting) entrada.target.classList.add('revelado') })
  }, { threshold: .15 })
  document.querySelectorAll('.secao, .recurso, .caixa-preco').forEach(el => observador.observe(el))
}
