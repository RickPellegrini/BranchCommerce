const INPUT_KEY = "branchHunter:lastInput";
const LISTING_KEY = "branchHunter:lastListing";

const inputIds = {
  salePrice: "sale-price",
  productCost: "product-cost",
  shippingCost: "shipping-cost",
  mlFeePercent: "ml-fee-percent",
  taxPercent: "tax-percent",
  fixedCost: "fixed-cost",
};

const resultIds = {
  fee: "result-fee",
  tax: "result-tax",
  payout: "result-payout",
  profit: "result-profit",
  margin: "result-margin",
};

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function getFormValues() {
  return {
    salePrice: parseNumber(document.getElementById(inputIds.salePrice).value),
    productCost: parseNumber(document.getElementById(inputIds.productCost).value),
    shippingCost: parseNumber(document.getElementById(inputIds.shippingCost).value),
    mlFeePercent: parseNumber(document.getElementById(inputIds.mlFeePercent).value),
    taxPercent: parseNumber(document.getElementById(inputIds.taxPercent).value),
    fixedCost: parseNumber(document.getElementById(inputIds.fixedCost).value),
  };
}

function setFormValues(values) {
  Object.entries(inputIds).forEach(([key, id]) => {
    const input = document.getElementById(id);
    if (!input) return;
    if (values[key] === undefined || values[key] === null) return;
    input.value = String(values[key]);
  });
}

function calculate() {
  const values = getFormValues();
  const mlFeeValue = values.salePrice * (values.mlFeePercent / 100);
  const taxValue = values.salePrice * (values.taxPercent / 100);
  const payout = values.salePrice - mlFeeValue - values.shippingCost - taxValue;
  const netProfit = payout - values.productCost - values.fixedCost;
  const netMargin = values.salePrice > 0 ? (netProfit / values.salePrice) * 100 : 0;

  document.getElementById(resultIds.fee).textContent = formatMoney(mlFeeValue);
  document.getElementById(resultIds.tax).textContent = formatMoney(taxValue);
  document.getElementById(resultIds.payout).textContent = formatMoney(payout);
  document.getElementById(resultIds.profit).textContent = formatMoney(netProfit);
  document.getElementById(resultIds.margin).textContent = formatPercent(netMargin);

  chrome.storage.local.set({
    [INPUT_KEY]: values,
  });
}

function resetForm() {
  setFormValues({
    salePrice: "",
    productCost: "",
    shippingCost: 0,
    mlFeePercent: 16,
    taxPercent: 0,
    fixedCost: 0,
  });
  calculate();
}

function renderListing(listing) {
  const titleElement = document.getElementById("listing-title");
  const urlElement = document.getElementById("listing-url");
  if (!listing) {
    titleElement.textContent = "Nenhum anuncio detectado";
    urlElement.textContent = "";
    return;
  }

  titleElement.textContent = listing.title || "Anuncio detectado";
  urlElement.textContent = listing.url || "";
}

function useListingPrice() {
  chrome.storage.local.get([LISTING_KEY], (data) => {
    const listing = data[LISTING_KEY];
    if (!listing || typeof listing.price !== "number") return;
    setFormValues({ salePrice: listing.price });
    calculate();
  });
}

function boot() {
  chrome.storage.local.get([INPUT_KEY, LISTING_KEY], (data) => {
    const savedInput = data[INPUT_KEY];
    if (savedInput) setFormValues(savedInput);

    renderListing(data[LISTING_KEY]);

    if (!savedInput?.salePrice && typeof data[LISTING_KEY]?.price === "number") {
      setFormValues({ salePrice: data[LISTING_KEY].price });
    }

    calculate();
  });

  document.getElementById("calculate").addEventListener("click", calculate);
  document.getElementById("reset").addEventListener("click", resetForm);
  document.getElementById("use-page-data").addEventListener("click", useListingPrice);
}

boot();
