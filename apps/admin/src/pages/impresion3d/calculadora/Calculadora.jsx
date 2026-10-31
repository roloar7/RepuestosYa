import { useMemo, useState } from "react"
import { BiCalculator } from "react-icons/bi"
import {
  MATERIALS,
  PRICE_PER_HOUR,
  POST_PROCESSING_PRICE_PER_HOUR,
  DEFAULT_PROFIT_MARGIN,
  materialList,
} from "../../../constants/printingCosts.js"
import styles from "./Calculadora.module.css"

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
})

function toNumber(value) {
  const parsed = Number.parseFloat(String(value).replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function Calculadora() {
  const [materialId, setMaterialId] = useState(materialList[0].id)
  const [weight, setWeight] = useState("50")
  const [printHours, setPrintHours] = useState("2")
  const [postHours, setPostHours] = useState("0")
  const [margin, setMargin] = useState(String(DEFAULT_PROFIT_MARGIN))

  const material = MATERIALS[materialId]

  const result = useMemo(() => {
    const grams = toNumber(weight)
    const hours = toNumber(printHours)
    const post = toNumber(postHours)
    const profit = toNumber(margin)

    const materialCost = (grams / 1000) * material.pricePerKg
    const printCost = hours * PRICE_PER_HOUR
    const postCost = post * POST_PROCESSING_PRICE_PER_HOUR
    const productionCost = materialCost + printCost + postCost
    const profitAmount = productionCost * (profit / 100)
    const finalPrice = productionCost + profitAmount

    return {
      grams,
      hours,
      materialCost,
      printCost,
      postCost,
      productionCost,
      profitAmount,
      finalPrice,
    }
  }, [material, weight, printHours, postHours, margin])

  return (
    <div className={styles.section}>
      <div className={styles.grid}>
        <form className={styles.panel} onSubmit={(event) => event.preventDefault()}>
          <header className={styles.panelHead}>
            <span className={styles.panelIcon}>
              <BiCalculator />
            </span>
            <div>
              <h3 className={styles.panelTitle}>Calculador de costos y precio final</h3>
              <p className={styles.panelText}>
                Ingresá el material y los consumos para estimar el costo.
              </p>
            </div>
          </header>

          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Material</span>
              <select
                className={styles.control}
                value={materialId}
                onChange={(event) => setMaterialId(event.target.value)}
              >
                {materialList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} — {currency.format(item.pricePerKg)}/kg
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Peso de la pieza (g)</span>
              <input
                className={styles.control}
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Tiempo de impresión (h)</span>
              <input
                className={styles.control}
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={printHours}
                onChange={(event) => setPrintHours(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Post-procesado (h)</span>
              <input
                className={styles.control}
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={postHours}
                onChange={(event) => setPostHours(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Ganancia (%)</span>
              <input
                className={styles.control}
                type="number"
                min="0"
                step="5"
                inputMode="decimal"
                value={margin}
                onChange={(event) => setMargin(event.target.value)}
              />
            </label>
          </div>

          <div className={styles.rates}>
            <p>
              Material: <strong>{currency.format(material.pricePerKg)}/kg</strong>
            </p>
            <p>
              Impresión: <strong>{currency.format(PRICE_PER_HOUR)}/h</strong>
            </p>
            <p>
              Post-procesado:{" "}
              <strong>{currency.format(POST_PROCESSING_PRICE_PER_HOUR)}/h</strong>
            </p>
          </div>
        </form>

        <aside className={styles.summary}>
          <h3 className={styles.summaryTitle}>Resumen de costos</h3>

          <ul className={styles.breakdown}>
            <li className={styles.breakdownItem}>
              <span>Filamento ({result.grams} g · {material.label})</span>
              <strong>{currency.format(result.materialCost)}</strong>
            </li>
            <li className={styles.breakdownItem}>
              <span>Impresión ({result.hours} h)</span>
              <strong>{currency.format(result.printCost)}</strong>
            </li>
            <li className={styles.breakdownItem}>
              <span>Post-procesado</span>
              <strong>{currency.format(result.postCost)}</strong>
            </li>
          </ul>

          <div className={styles.productionRow}>
            <span>Costo de producción</span>
            <strong>{currency.format(result.productionCost)}</strong>
          </div>

          <div className={styles.profitRow}>
            <span>Ganancia ({margin || 0}%)</span>
            <strong>{currency.format(result.profitAmount)}</strong>
          </div>

          <div className={styles.finalCard}>
            <span className={styles.finalLabel}>Precio final de venta</span>
            <span className={styles.finalValue}>
              {currency.format(result.finalPrice)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Calculadora
