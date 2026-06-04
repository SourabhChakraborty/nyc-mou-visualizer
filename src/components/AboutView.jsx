export default function AboutView() {
  return (
    <div className="about-container">
      <div className="about-content">
        <section className="about-section">
          <h2>What is a data sharing agreement?</h2>
          <p>
            When two New York City agencies want to share information with each other — resident
            records, enrollment data, case files — they formalize it in a Memorandum of
            Understanding (MOU). The MOU specifies what data is shared, for what purpose, who
            can access it, and how long it can be kept. Under Local Law 40 of 2011, NYC agencies
            are required to publish these agreements publicly.
          </p>
          <p>
            For example: the Department of Education shares student enrollment data with the
            Department of Health and Mental Hygiene to identify children eligible for health
            services. The MOU defines exactly which fields travel between the agencies, who is
            authorized to see them, and what happens to the data when the purpose is fulfilled.
          </p>
        </section>

        <section className="about-section">
          <h2>Why it matters</h2>

          <div className="about-reason">
            <h3>Government can work for you, not just about you.</h3>
            <p>
              Data sharing agreements are the infrastructure behind proactive government — the
              kind that enrolls a child in free school lunch when their family applies for housing
              assistance, or flags a senior for energy assistance when they apply for Medicaid.
              Instead of asking residents to prove eligibility separately at every agency, shared
              data lets the city connect people to services they already qualify for.
            </p>
          </div>

          <div className="about-reason">
            <h3>But the same infrastructure cuts both ways.</h3>
            <p>
              Data shared for one purpose can be repurposed in ways residents didn't anticipate
              or consent to. Benefits data has reached law enforcement. Immigration status has
              traveled further than applicants knew. MOUs are the paper trail that shows what
              was agreed to — and what limits, if any, were placed on that use.
            </p>
          </div>

          <div className="about-reason">
            <h3>These agreements are public, but buried.</h3>
            <p>
              Local Law 40 requires publication, but the agreements are scattered across agency
              websites, inconsistently formatted, and hard to search. This tool maps the full
              network in one place so residents, journalists, and advocates can see how city
              agencies are connected — and ask questions about agreements that seem surprising.
            </p>
          </div>
        </section>

        <section className="about-section about-section--meta">
          <p>
            Data sourced from NYC agency MOU pages under{' '}
            <a href="https://www.nyc.gov/site/records/about/agency-mous.page" target="_blank" rel="noreferrer">
              Local Law 40 of 2011
            </a>
            . Confirmed entries link to published PDFs; seeded entries are manually curated
            and not yet verified against a source document.
          </p>
        </section>
      </div>
    </div>
  )
}
