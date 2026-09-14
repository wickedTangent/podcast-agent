# Episode --- -- FDE: The $1M/Year AI Job Explained

**Episode Number:** Unknown
**Date:** 2026-07-20
**Source:** [Episode Page](https://podscripts.co/podcasts/the-startup-ideas-podcast/fde-the-1myear-ai-job-explained)

## Topics Covered

### Forward-Deployed Engineering (FDE) as a Role
Voss (Vasuman Moza) from Varick Agents defines forward-deployed engineering as the critical bridge between general AI intelligence and company-specific business processes. As foundational AI models become commoditized -- with every enterprise accessing the same Claude, GPT, Gemini, or open-source models through tools like Cursor and GitHub Copilot -- the competitive advantage shifts from who has intelligence to how and where it gets deployed. FDEs embed on-site with clients to understand real workflows (not documented ones), determine where AI belongs versus where it doesn't, and build custom agent solutions. The role demands a rare combination of deep technical skills (models, APIs, reliability, evals, guardrails) and strong communication/consulting abilities (understanding workflows, incentives, risk, adoption).

- [Palantir Forward Deployed AI Engineer -- Careers](https://jobs.lever.co/palantir/636fc05c-d348-4a06-be51-597cb9e07488) - Palantir's own job description: FDEs own Gen AI strategy and implementation, build end-to-end workflows, and take them to production
- [What Is a Forward Deployed Engineer? -- IIT](https://www.iit.edu/blog/forward-deployed-engineer) - Definition: software engineers embedded directly with customers to design, build, and ship custom solutions
- [2026 Forward Deployed Engineering Compensation Report -- Perspective AI](https://getperspective.ai/blog/2026-forward-deployed-engineering-compensation-report-1200-fdes) - Total compensation ranges from $215K at Palantir's median to north of $785K for senior FDEs at Anthropic and OpenAI

### Palantir's FDE Model and Foundry Ontology
Palantir popularized the FDE term. Their platform centers on Foundry, an enterprise data platform with an "ontology" layer that ingests and models enterprise data as interconnected objects, actions, and processes. Palantir FDEs are deployed on-site at enterprise, military, or government clients to learn workflows and spin up dashboards, workflows, and agents on top of the ontology. The platform's strength is not just its technology but its customizability -- FDEs customize it per client to solve specific pain points better than generalized services. Voss notes that the AI age demands this model "100 times more" since every company needs customized agents.

- [Palantir Foundry Platform](https://www.palantir.com/platforms/foundry/) - Official platform page: compose AI-powered workflows on scalable architecture that reuses the ontology's multi-modal objects, actions, and processes
- [The Ontology System -- Palantir Docs](https://palantir.com/docs/foundry/architecture-center/ontology-system/) - Official documentation: the ontology represents complex enterprise decisions, enabling both humans and AI agents to operate on unified data
- [AI FDE Overview -- Palantir Docs](https://palantir.com/docs/foundry/ai-fde/overview/) - AI FDE as an AI-powered agent that operates Foundry through conversational commands, translating natural language into Foundry operations

### FDE Compensation and Market Demand
FDE roles are described as "the hottest role in technology" with extreme compensation. Base salaries start around $150K with considerable equity, and total compensation can reach up to $1M/year for top performers. According to Perspective AI's 2026 compensation report analyzing 1,200 FDEs, Palantir's median is $215K while senior FDEs at Anthropic and OpenAI can exceed $785K. Job postings grew from 643 in April 2025 to 5,330 by April 2026 on Indeed -- roughly an 800% increase. The transcript cites salaries of $150K base with equity to $1M/year for exceptional FDEs who combine consulting excellence with engineering mastery.

- [2026 Forward Deployed Engineering Compensation Report](https://getperspective.ai/blog/2026-forward-deployed-engineering-compensation-report-1200-fdes) - Perspective AI report analyzing 1,200 FDEs: $215K Palantir median to $785K+ at Anthropic/OpenAI
- [What Is a Forward Deployed Engineer? Role, Skills, Salary -- Glocomms](https://www.glocomms.com/en-us/industry-insights/hiring-advice/what-is-a-forward-deployed-engineer) - Job postings grew from 643 (April 2025) to 5,330 (April 2026) on Indeed
- [Analyzed 1K FDE Jobs -- Bloomberry](https://bloomberry.com/blog/i-analyzed-1000-forward-deployed-engineer-jobs-what-i-learned/) - Median FDE salary $173,816; 70% of postings mention compensation ranges

### AI Agent Building: Tools, Guardrails, and Audit Trails
Voss presents a 30-day plan for becoming an FDE, starting with building a working agent that completes a real workflow loop. The plan covers: Day 1-7 focuses on agent looping, tool usage, guardrails, context/memory, and audit trails. Day 8-14 adds failure mode handling and exception logic (building for the "unhappy path" with 1,500+ failure scenarios). Day 15-21 introduces evaluation suites with golden datasets and cost optimization using cheaper models for sub-tasks. Day 22-30 covers business defense -- articulating architecture decisions, accuracy improvements (70% to 95%), cost savings, and revenue impact. A critical principle: if you cannot show the client what the agent is doing through logged traces, they will never trust the system.

- [Building Governed Agents -- LangChain Blog](https://www.langchain.com/blog/building-governed-agents-a-framework-for-cost-control-and-compliance) - Framework for audit trails, policy versioning, and compliance in AI agent systems
- [Top 9 AI Agent Frameworks -- Shakudo](https://www.shakudo.io/blog/top-9-ai-agent-frameworks) - September 2026 overview of agent frameworks with audit trail capabilities and system health diagnostics
- [AI Agent Evaluation: 5 Lessons Learned -- Monte Carlo](https://montecarlo.ai/blog-ai-agent-evaluation) - Best practices: soft failures, automatic retries, explanations, evaluating evaluators, and conservative triggers

### AI Agent Evaluation (Evals) for Non-Deterministic Tasks
Creating evals for non-deterministic AI tasks (like presentation generation) is harder than for deterministic ones (like email categorization where 10,000 labeled examples exist). Voss recommends building golden datasets from historical data, establishing what "good" and "bad" look like, and always baking in human-in-the-loop feedback as a continuous improvement mechanism. The eval framework should distinguish between deterministic software, agent actions, and human approval -- and route to humans wherever a system cannot safely act. A practical example: if 50 eval runs yield 41 passes and 9 failures, investigate why (e.g., 5 had missing data, 4 had wrong records pulled) and use findings to improve the system.

- [AI Agent Evaluation: Key Methods & Insights -- Galileo](https://galileo.ai/blog/ai-agent-evaluation) - Non-deterministic behavior requires new metrics beyond traditional accuracy, precision, and recall
- [Evaluating and Debugging Non-Deterministic AI Agents](https://www.getmaxim.ai/articles/evaluating-ai-agents-metrics-and-best-practices/) - Guide covering metrics and best practices for evaluating AI agents effectively
- [AI Agent Security Best Practices -- Arthur AI](https://www.arthur.ai/column/ai-agent-security-best-practices-enterprise) - Agents are non-deterministic; an agent passing tests today may fail tomorrow with new production inputs

### Model Agnosticism vs. Ecosystem Specialization
Varick Agents is model-agnostic -- they switch between models to improve accuracy and reduce costs without locking clients into one provider. However, Voss advises aspiring FDEs to master one model ecosystem first (OpenAI, Anthropic, Google, etc.) before going multi-model. Each provider offers its own agent SDK and building platform. Once deeply proficient in one ecosystem, you can then experiment with others (Kimi 3, Gemini, open-source models) and build proprietary harnesses. The key insight: model selection expertise matters for client engagements, but your core value as an FDE lies in understanding business workflows and engineering -- skills that transfer across any model.

- [How to Build a Tool-Agnostic AI Agent Stack -- MindStudio](https://www.mindstudio.ai/blog/tool-agnostic-ai-agent-stack-model-wars) - Model-agnostic means your stack can run on any model; multi-model means actively using multiple models
- [Why Model-Agnostic Governance Is the Only Enterprise AI Strategy That Scales -- Airia](https://airia.com/blog/why-model-agnostic-governance-is-the-only-enterprise-ai-strategy-that-scales/) - Enterprise governance layer that works across OpenAI, Anthropic, and other providers
- [The Complete Guide to Choosing an AI Agent Framework -- Langflow](https://www.langflow.org/blog/the-complete-guide-to-choosing-an-ai-agent-framework-in-2025/) - Comparison of self-hosted solutions (Langflow, LangChain, CrewAI) for data residency, audit logs, and compliance

### AI Implementation Strategy: Audit, Evals, Deploy
The core thesis: AI implementation should follow a three-phase cycle. Phase 1 is the audit -- mapping real workflows (not documented ones), identifying bottlenecks, repetitive work, and judgment points, then producing a priority/ROI matrix. The audit is positioned as more valuable than McKinsey because it's AI-specific and actionable; companies report it was worth 10x what they paid. Phase 2 is evals -- creating evaluation suites with golden datasets and human-in-the-loop feedback. Phase 3 is deployment -- integrating with existing systems (not forcing migrations), moving through shadow mode to increasing autonomy to production. Voss recommends doing the initial audit for free to de-risk the engagement for skeptical clients, then charging only after proving measurable value. This cycle repeats: once one workflow is optimized, interconnected bottlenecks elsewhere become visible, compounding the impact across the entire organization.

- [MIT Report: 95% of Generative AI Pilots Fail -- Fortune](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/) - MIT study: 95% of GenAI pilots fail to generate financial profit; the "GenAI Divide" stems from lack of workflow integration and domain specificity
- [Why 95% of GenAI Projects Fail -- Trullion](https://trullion.com/blog/why-95-of-ai-projects-fail-and-why-the-5-that-survive-matter/) - Success requires workflow integration, domain specificity, and vendor-led solutions rather than "token maxing"
- [6 Hard Truths Behind MIT's AI Finding -- CloudFactory](https://www.cloudfactory.com/blog/6-hard-truths-behind-mits-ai-finding) - Breakdown of why most AI projects fail and what separates the 5% that succeed

## Key Announcements

- **Varick Agents / Vasuman Moza** - Company focused on forward-deployed AI implementation for enterprise clients; offers 30-day FDE training program (interest-based, not yet launched as of episode)
- **Palantir AI FDE** - AI-powered agent within Foundry that translates natural language into Foundry operations including data transformations, code management, and ontology building ([docs](https://palantir.com/docs/foundry/ai-fde/overview/))
- **2026 FDE Compensation Report** - Perspective AI published compensation data across 1,200 FDEs showing median $215K at Palantir to $785K+ at Anthropic/OpenAI

## Links to Explore

- [Why AI Agents Are Changing the FDE Role -- FDE Academy](https://fde.academy/blog/why-ai-agents-are-changing-the-forward-deployed-engineer-role) - How AI agents reshape FDE work from writing code to orchestrating autonomous systems
- [Vasuman Moza on AI Tools for Forward Deployed Engineering -- YouTube](https://www.youtube.com/watch?v=l0FLhNqBOic) - Voss discussing AI tools for FDE work
- [BigGo Finance: AI Tools for FDE with Vasuman Moza, Varick Agents](https://finance.biggo.com/podcast/9d9547e7e089702d) - Podcast coverage of Varick Agents' forward deployed engineering methodology
