import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileSearch,
  Landmark,
  LockKeyhole,
  Map,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Eyebrow, Notice, StatusBadge } from "@/components/Ui";
import study from "@/model-lab/artifacts/study-report.json";
import nationalCoverage from "@/model-manifest/national-coverage.json";

export default function Home() {
  return (
    <>
      <section className="hero-section">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <Eyebrow>Horizonte electoral 2027 · pre-lanzamiento</Eyebrow>
            <h1>
              Tu economía, explicada <em>sin pedirte el voto.</em>
            </h1>
            <p className="hero-lead">
              Compara cómo distintas políticas fiscales podrían afectar a tu hogar.
              Una estimación informativa basada en reglas, fuentes y supuestos
              transparentes.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/calculator">
                Calcular mi impacto <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="button button-quiet" href="/scenarios">
                Explorar políticas
              </Link>
            </div>
            <ul className="trust-list" aria-label="Compromisos de confianza">
              <li>
                <Check aria-hidden="true" /> Sin cuenta
              </li>
              <li>
                <Check aria-hidden="true" /> Datos no guardados
              </li>
              <li>
                <Check aria-hidden="true" /> Método visible
              </li>
              <li>
                <Check aria-hidden="true" /> Sin recomendación política
              </li>
            </ul>
          </div>

          <div className="hero-visual" aria-label="Ejemplo sintético del panel de resultados">
            <div className="paper-card result-preview">
              <div className="preview-topline">
                <div>
                  <p className="micro-label">Ejemplo de resultado</p>
                  <p className="preview-household">Hogar de 2 adultos + 1 menor</p>
                </div>
                <StatusBadge tone="demo">DATOS DEMO</StatusBadge>
              </div>
              <div className="preview-main-number">
                <span>Variación anual estimada</span>
                <strong>+624 €</strong>
                <small>+52 € / mes</small>
              </div>
              <div className="comparison-bars" aria-hidden="true">
                <div>
                  <span>Referencia</span>
                  <i style={{ width: "78%" }} />
                  <b>31.840 €</b>
                </div>
                <div>
                  <span>Escenario</span>
                  <i style={{ width: "86%" }} />
                  <b>32.464 €</b>
                </div>
              </div>
              <div className="preview-breakdown">
                <div>
                  <span>IRPF estatal</span>
                  <strong>+210 €</strong>
                </div>
                <div>
                  <span>IRPF autonómico</span>
                  <strong>0 €</strong>
                </div>
                <div>
                  <span>Cotizaciones</span>
                  <strong>+114 €</strong>
                </div>
                <div>
                  <span>Créditos y ayudas</span>
                  <strong>+300 €</strong>
                </div>
              </div>
              <div className="preview-meta">
                <span>Modelo 0.1</span>
                <span>Confianza: alta incertidumbre</span>
                <span>2027 · referencia pendiente</span>
              </div>
            </div>
            <div className="floating-note floating-note-one">
              <ShieldCheck size={17} aria-hidden="true" />
              Tus cifras se procesan sin crear un perfil
            </div>
            <div className="floating-note floating-note-two">
              <FileSearch size={17} aria-hidden="true" />
              Cada resultado enlaza sus fuentes
            </div>
          </div>
        </div>
      </section>

      <section className="trust-band" aria-label="Principios del servicio">
        <div className="shell trust-band-grid">
          <div>
            <LockKeyhole aria-hidden="true" />
            <span><strong>Privacidad real</strong>Sin cuentas ni píxeles publicitarios</span>
          </div>
          <div>
            <Scale aria-hidden="true" />
            <span><strong>Neutralidad política</strong>Impactos, nunca recomendaciones</span>
          </div>
          <div>
            <Landmark aria-hidden="true" />
            <span><strong>Reglas trazables</strong>Versiones, fechas y fuentes públicas</span>
          </div>
        </div>
      </section>

      <section className="coverage-band" aria-label="Cobertura combinatoria del modelo">
        <div className="shell coverage-band-inner">
          <div>
            <span>Trabajo auditado · dos manifiestos públicos</span>
            <strong>{(61_980_085_440 + nationalCoverage.declaredEvaluatedCount).toLocaleString("es-ES")}</strong>
          </div>
          <p>
            61.980.085.440 estados deterministas direccionables del motor personal más{" "}
            {nationalCoverage.declaredEvaluatedCount.toLocaleString("es-ES")} aplicaciones de
            parámetro-caso ejecutadas por el estudio del laboratorio nacional, junto a{" "}
            {study.coverage.exactScenarioEvaluations.toLocaleString("es-ES")} pruebas exactas de hogar.
            Cada cifra sale de un manifiesto auditable: son estados y evaluaciones deterministas,
            nunca pesos de una IA ni personas.
          </p>
          <Link href="/methodology/statistical-study">Ver las pruebas <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="section how-section">
        <div className="shell">
          <div className="section-heading split-heading">
            <div>
              <Eyebrow>Una pregunta concreta</Eyebrow>
              <h2>¿Qué cambia en casa?</h2>
            </div>
            <p>
              Introduce solo los datos que afectan al cálculo. Cifra Cívica separa
              ingresos, IRPF estatal, tramo autonómico, cotizaciones y ayudas para que
              puedas seguir la cifra de principio a fin.
            </p>
          </div>
          <ol className="process-grid">
            <li>
              <span>01</span>
              <h3>Describe tu hogar</h3>
              <p>Residencia, personas adultas, menores y modalidad de declaración.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Añade tus cifras</h3>
              <p>Ingresos, pensiones, prestaciones, alquiler y ahorro en euros anuales.</p>
            </li>
            <li>
              <span>03</span>
              <h3>Elige escenarios</h3>
              <p>Compara la referencia con hasta tres políticas bajo los mismos supuestos.</p>
            </li>
            <li>
              <span>04</span>
              <h3>Revisa el porqué</h3>
              <p>Ve el desglose, la incertidumbre, las fuentes y descarga un resumen local.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section feature-section">
        <div className="shell feature-grid">
          <article className="feature-card feature-calculator">
            <div className="feature-icon"><BarChart3 aria-hidden="true" /></div>
            <StatusBadge tone="official">HOGAR</StatusBadge>
            <h2>Una comparación personal, no una etiqueta.</h2>
            <p>
              Calcula ingresos disponibles anuales y mensuales. El resultado explica cada
              componente y conserva el mismo lenguaje neutral para aumentos y disminuciones.
            </p>
            <ul className="check-list">
              <li><Check aria-hidden="true" /> Comparación individual y conjunta</li>
              <li><Check aria-hidden="true" /> IRPF estatal y autonómico separados</li>
              <li><Check aria-hidden="true" /> Supuestos visibles, no escondidos</li>
            </ul>
            <Link href="/calculator">Abrir calculadora <ArrowRight size={17} aria-hidden="true" /></Link>
          </article>
          <article className="feature-card feature-map">
            <div className="feature-icon"><Map aria-hidden="true" /></div>
            <StatusBadge tone="official">TERRITORIO</StatusBadge>
            <h2>El presupuesto de España, palanca a palanca.</h2>
            <p>
              Sube o baja el IRPF por tramos, los carburantes, el juego o el patrimonio;
              mueve el gasto en educación, defensa o carreteras, y mira sobre un mapa
              interactivo qué comunidades, familias, edades y rentas ganan o pierden.
            </p>
            <ul className="check-list">
              <li><Check aria-hidden="true" /> Palancas estatales y de cada comunidad</li>
              <li><Check aria-hidden="true" /> Impacto por renta, familia y edad</li>
              <li><Check aria-hidden="true" /> Efecto en déficit e ingresos al instante</li>
            </ul>
            <Link href="/laboratorio">Abrir el laboratorio <ArrowRight size={17} aria-hidden="true" /></Link>
          </article>
        </div>
      </section>

      <section className="section principles-section">
        <div className="shell principles-grid">
          <div>
            <Eyebrow>Neutralidad por diseño</Eyebrow>
            <h2>La cifra informa.<br />La decisión es tuya.</h2>
            <p>
              Cifra Cívica no puntúa afinidades, no ordena partidos y no convierte tus
              circunstancias económicas en una predicción política.
            </p>
            <Link className="text-link" href="/methodology">
              Leer nuestros principios <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="principle-list">
            <div>
              <span>01</span>
              <div><h3>Sin “ganadores” ni “perdedores”</h3><p>Mostramos variaciones estimadas con la misma jerarquía visual.</p></div>
            </div>
            <div>
              <span>02</span>
              <div><h3>Sin preferencias inferidas</h3><p>No creamos perfiles políticos ni audiencias publicitarias.</p></div>
            </div>
            <div>
              <span>03</span>
              <div><h3>Sin falsa precisión</h3><p>Las lagunas del modelo elevan la incertidumbre y aparecen junto al resultado.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section sources-section">
        <div className="shell">
          <div className="section-heading centered-heading">
            <Eyebrow>Fuentes y gobernanza</Eyebrow>
            <h2>La trazabilidad también forma parte del producto.</h2>
            <p>
              Cada regla incluye versión, fecha de revisión, alcance territorial,
              responsable de validación y enlace a su registro de origen.
            </p>
          </div>
          <div className="source-rail">
            {[
              ["AEAT", "Reglas y estadísticas de IRPF"],
              ["INE", "Ingresos y geografía oficial"],
              ["BOE", "Normativa consolidada"],
              ["Seguridad Social", "Cotizaciones y pensiones"],
              ["EUROMOD", "Referencia metodológica"],
            ].map(([name, description]) => (
              <div key={name}><strong>{name}</strong><span>{description}</span></div>
            ))}
          </div>
          <Notice tone="warning" title="2027 todavía no está cerrado">
            Esta versión de pre-lanzamiento usa la última referencia revisada disponible.
            Antes de una publicación electoral, la normativa y cada propuesta deberán
            pasar una nueva revisión fiscal y sus pruebas de regresión.
          </Notice>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-inner">
          <div>
            <Sparkles aria-hidden="true" />
            <Eyebrow>Empieza sin registrarte</Eyebrow>
            <h2>Convierte una propuesta en una cifra que puedas comprobar.</h2>
          </div>
          <Link className="button button-light" href="/calculator">
            Calcular mi impacto <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
