// Listas que usa el recolector. Se pueden ampliar sin tocar el resto del programa.

// Indicadores del Banco Mundial: nombre que usa Atlas -> código oficial del indicador.
export const INDICADORES = {
  pib: 'NY.GDP.MKTP.CD', // PIB en dólares corrientes
  pibPerCapita: 'NY.GDP.PCAP.CD', // PIB por habitante
  crecimiento: 'NY.GDP.MKTP.KD.ZG', // Crecimiento real del PIB (% anual)
  inflacion: 'FP.CPI.TOTL.ZG', // Inflación, precios al consumo (% anual)
  paro: 'SL.UEM.TOTL.ZS', // Paro (% de la población activa)
  exportaciones: 'NE.EXP.GNFS.CD', // Exportaciones de bienes y servicios (dólares)
  exportPctPib: 'NE.EXP.GNFS.ZS', // Exportaciones (% del PIB)
  poblacion: 'SP.POP.TOTL', // Población
};

// Fondos cotizados (ETF) que replican la bolsa de cada país. Cotizan en dólares en EE. UU.
// [código del país, símbolo del fondo, nombre del fondo]
export const ETF_PAISES = [
  ['USA', 'SPY', 'SPDR S&P 500'],
  ['CAN', 'EWC', 'iShares MSCI Canada'],
  ['MEX', 'EWW', 'iShares MSCI Mexico'],
  ['BRA', 'EWZ', 'iShares MSCI Brazil'],
  ['ARG', 'ARGT', 'Global X MSCI Argentina'],
  ['CHL', 'ECH', 'iShares MSCI Chile'],
  ['PER', 'EPU', 'iShares MSCI Peru'],
  ['ESP', 'EWP', 'iShares MSCI Spain'],
  ['DEU', 'EWG', 'iShares MSCI Germany'],
  ['FRA', 'EWQ', 'iShares MSCI France'],
  ['ITA', 'EWI', 'iShares MSCI Italy'],
  ['GBR', 'EWU', 'iShares MSCI United Kingdom'],
  ['CHE', 'EWL', 'iShares MSCI Switzerland'],
  ['NLD', 'EWN', 'iShares MSCI Netherlands'],
  ['BEL', 'EWK', 'iShares MSCI Belgium'],
  ['AUT', 'EWO', 'iShares MSCI Austria'],
  ['IRL', 'EIRL', 'iShares MSCI Ireland'],
  ['SWE', 'EWD', 'iShares MSCI Sweden'],
  ['DNK', 'EDEN', 'iShares MSCI Denmark'],
  ['NOR', 'ENOR', 'iShares MSCI Norway'],
  ['FIN', 'EFNL', 'iShares MSCI Finland'],
  ['POL', 'EPOL', 'iShares MSCI Poland'],
  ['GRC', 'GREK', 'Global X MSCI Greece'],
  ['TUR', 'TUR', 'iShares MSCI Turkey'],
  ['ISR', 'EIS', 'iShares MSCI Israel'],
  ['SAU', 'KSA', 'iShares MSCI Saudi Arabia'],
  ['ARE', 'UAE', 'iShares MSCI UAE'],
  ['QAT', 'QAT', 'iShares MSCI Qatar'],
  ['KWT', 'KWT', 'iShares MSCI Kuwait'],
  ['ZAF', 'EZA', 'iShares MSCI South Africa'],
  ['JPN', 'EWJ', 'iShares MSCI Japan'],
  ['CHN', 'MCHI', 'iShares MSCI China'],
  ['HKG', 'EWH', 'iShares MSCI Hong Kong'],
  ['TWN', 'EWT', 'iShares MSCI Taiwan'],
  ['KOR', 'EWY', 'iShares MSCI South Korea'],
  ['IND', 'INDA', 'iShares MSCI India'],
  ['SGP', 'EWS', 'iShares MSCI Singapore'],
  ['MYS', 'EWM', 'iShares MSCI Malaysia'],
  ['THA', 'THD', 'iShares MSCI Thailand'],
  ['IDN', 'EIDO', 'iShares MSCI Indonesia'],
  ['PHL', 'EPHE', 'iShares MSCI Philippines'],
  ['VNM', 'VNM', 'VanEck Vietnam'],
  ['AUS', 'EWA', 'iShares MSCI Australia'],
  ['NZL', 'ENZL', 'iShares MSCI New Zealand'],
];

// Otros fondos que salen en la cinta superior de la app (no son países).
// [clave, símbolo, etiqueta que ve el usuario]
export const ETF_EXTRA = [
  ['NASDAQ', 'QQQ', 'Nasdaq 100'],
  ['MUNDO', 'ACWI', 'Bolsa mundial'],
  ['ORO', 'GLD', 'Oro'],
  ['PETROLEO', 'BNO', 'Petróleo Brent'],
  ['EURUSD', 'FXE', 'Euro frente al dólar'],
];

// WITS usa algunos códigos de país antiguos. Aquí se traducen al código ISO actual.
export const ALIAS_WITS = {
  ROM: 'ROU', // Rumanía
  ZAR: 'COD', // R. D. del Congo
  SER: 'SRB', // Serbia
  MNT: 'MNE', // Montenegro
  SUD: 'SDN', // Sudán
  TMP: 'TLS', // Timor Oriental
  OAS: 'TWN', // "Otros Asia": así registra Naciones Unidas el comercio con Taiwán
};
