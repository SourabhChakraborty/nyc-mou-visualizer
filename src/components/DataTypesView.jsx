import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { DATA_TYPE_DOMAIN, DOMAIN_COLORS } from '../data/dataTypes'

export { DOMAIN_COLORS, DATA_TYPE_DOMAIN }

export default function DataTypesView({ agreements, agencyMap, onSelect }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [selectedType, setSelectedType] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  // Build data-type frequency map from filtered agreements
  const typeData = useMemo(() => {
    const map = new Map()
    agreements.forEach(a => {
      (a.dataTypes ?? []).forEach(dt => {
        if (!map.has(dt)) map.set(dt, { type: dt, agreements: [], domain: DATA_TYPE_DOMAIN[dt] ?? 'Administrative' })
        map.get(dt).agreements.push(a)
      })
    })
    return [...map.values()].sort((a, b) => b.agreements.length - a.agreements.length)
  }, [agreements])

  const matchingAgreements = useMemo(() => {
    if (!selectedType) return []
    return typeData.find(d => d.type === selectedType)?.agreements ?? []
  }, [selectedType, typeData])

  useEffect(() => {
    if (!containerRef.current || typeData.length === 0) return
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    const maxCount = Math.max(...typeData.map(d => d.agreements.length), 1)
    const rScale = d3.scaleSqrt().domain([1, maxCount]).range([24, 60])

    const nodes = typeData.map(d => ({
      ...d,
      r: rScale(d.agreements.length),
    }))

    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.5, 3]).on('zoom', e => g.attr('transform', e.transform)))

    const sim = d3.forceSimulation(nodes)
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('charge', d3.forceManyBody().strength(8))
      .force('collide', d3.forceCollide(d => d.r + 6).iterations(3))
      .stop()

    // Run simulation to convergence (static layout — no animation needed for bubbles)
    for (let i = 0; i < 300; i++) sim.tick()

    const node = g.selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        setTooltip({
          x: event.clientX - container.getBoundingClientRect().left,
          y: event.clientY - container.getBoundingClientRect().top,
          content: `${d.type}\n${d.agreements.length} agreement${d.agreements.length !== 1 ? 's' : ''}\nDomain: ${d.domain}`,
        })
      })
      .on('mousemove', (event) => {
        setTooltip(t => t ? {
          ...t,
          x: event.clientX - container.getBoundingClientRect().left,
          y: event.clientY - container.getBoundingClientRect().top,
        } : null)
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (_, d) => {
        setSelectedType(prev => prev === d.type ? null : d.type)
      })

    node.append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.r)
      .attr('fill', d => DOMAIN_COLORS[d.domain] ?? '#64748b')
      .attr('fill-opacity', d => d.type === selectedType ? 1 : 0.75)
      .attr('stroke', d => d.type === selectedType ? '#fff' : 'transparent')
      .attr('stroke-width', 2)

    // Label: two lines — type name and count
    node.append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .style('font-size', d => d.r > 40 ? '12px' : '10px')
      .each(function(d) {
        const el = d3.select(this)
        const words = d.type.split(' ')
        // Wrap into at most 2 lines
        if (words.length <= 2 || d.r < 32) {
          el.text(d.type)
        } else {
          const mid = Math.ceil(words.length / 2)
          el.append('tspan').attr('x', d.x).attr('dy', 0).text(words.slice(0, mid).join(' '))
          el.append('tspan').attr('x', d.x).attr('dy', '1.2em').text(words.slice(mid).join(' '))
        }
      })

    node.append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y + d.r - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.7)')
      .attr('font-size', '11px')
      .attr('pointer-events', 'none')
      .text(d => d.agreements.length)

    return () => sim.stop()
  }, [typeData, selectedType])

  const domains = [...new Set(typeData.map(d => d.domain))].sort()

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Bubble chart */}
      <div className="network-container" ref={containerRef} style={{ flex: 1 }}>
        <svg ref={svgRef} />

        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: '#161b27',
            border: '1px solid #2a3348',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: '#e2e8f0',
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
            zIndex: 10,
            lineHeight: 1.5,
          }}>
            {tooltip.content}
          </div>
        )}

        <div className="network-hint">
          Click a bubble to see matching agreements · Scroll to zoom
        </div>

        <div className="network-legend">
          <h4>Domains</h4>
          {domains.map(d => (
            <div key={d} className="legend-item">
              <div className="legend-dot" style={{ background: DOMAIN_COLORS[d] ?? '#64748b' }} />
              {d}
            </div>
          ))}
        </div>

        {typeData.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', fontSize: 14 }}>
            No agreements match the current filters.
          </div>
        )}
      </div>

      {/* Selected type agreement list */}
      {selectedType && (
        <div className="detail-panel" style={{ width: 320 }}>
          <div className="detail-header">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                className="category-badge"
                style={{
                  alignSelf: 'flex-start',
                  background: (DOMAIN_COLORS[DATA_TYPE_DOMAIN[selectedType] ?? 'Administrative'] ?? '#64748b') + '22',
                  color: DOMAIN_COLORS[DATA_TYPE_DOMAIN[selectedType] ?? 'Administrative'] ?? '#64748b',
                }}
              >
                {DATA_TYPE_DOMAIN[selectedType] ?? 'Administrative'}
              </div>
              <h3 style={{ margin: 0 }}>{selectedType}</h3>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {matchingAgreements.length} agreement{matchingAgreements.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button className="detail-close" onClick={() => setSelectedType(null)}>×</button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {matchingAgreements.map(a => (
              <div
                key={a.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #2a3348',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e2535'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => onSelect(a)}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', marginBottom: 6, lineHeight: 1.4 }}>
                  {a.title}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                  {a.parties.map(p => (
                    <span key={p} className="party-tag" title={agencyMap[p]?.name}>{p}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{a.year}</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(a.dataTypes ?? []).map(dt => (
                      <span
                        key={dt}
                        style={{
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: (DOMAIN_COLORS[DATA_TYPE_DOMAIN[dt]] ?? '#64748b') + '20',
                          color: DOMAIN_COLORS[DATA_TYPE_DOMAIN[dt]] ?? '#64748b',
                          fontWeight: dt === selectedType ? 700 : 400,
                          border: dt === selectedType ? `1px solid ${DOMAIN_COLORS[DATA_TYPE_DOMAIN[dt]] ?? '#64748b'}55` : 'none',
                        }}
                      >
                        {dt}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
