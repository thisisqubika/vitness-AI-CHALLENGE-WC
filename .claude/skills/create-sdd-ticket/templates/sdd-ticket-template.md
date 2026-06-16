# [TICKET-ID]: [Concise Title]

## 📋 User Story

**As a** [user role/persona]
**I want** [goal/capability]
**So that** [benefit/value]

---

## 👥 Stakeholders

| Role | Name | Responsibility |
|------|------|----------------|
| Requester | [Name] | Initial request, requirements validation |
| Product Owner | [Name] | Acceptance, prioritization |
| Tech Lead | [Name] | Architecture review, technical approval |
| End Users | [Group/Role] | Primary beneficiaries |

---

## 🎯 Success Criteria

1. [Measurable outcome 1]
2. [Measurable outcome 2]
3. [Measurable outcome 3]

**Metrics**: [How we'll measure success]

---

## ✅ Acceptance Criteria

### Scenario 1: [Happy Path]
```gherkin
Given [initial context/state]
And [additional context if needed]
When [action/trigger]
Then [expected outcome]
And [additional outcome if needed]
```

### Scenario 2: [Edge Case 1]
```gherkin
Given [context]
When [action]
Then [outcome]
```

### Scenario 3: [Error Case]
```gherkin
Given [context]
When [action]
Then [outcome]
```

### Scenario 4: [Additional scenario if needed]
```gherkin
Given [context]
When [action]
Then [outcome]
```

---

## 🔧 Technical Context

### Current State
- [What exists today]
- [Relevant systems/components]

### Proposed Changes
- [What will be built/modified]
- [Technologies/libraries to use]

### Technical Constraints
- [Performance requirements]
- [Security requirements]
- [Scalability considerations]

### Integration Points
- [Systems to integrate with]
- [APIs to call/expose]

### Architecture Decisions
- [Key technical choices]
- [Rationale for approach]

---

## 🚫 Out of Scope

The following are explicitly NOT part of this ticket:
1. [Item 1]
2. [Item 2]
3. [Item 3]

**Future Considerations**: [What might be addressed later]

---

## ⚠️ Edge Cases & Error Handling

### Edge Cases
1. **[Edge case 1]**: [How to handle]
2. **[Edge case 2]**: [How to handle]

### Error Scenarios
1. **[Error 1]**: [User-facing message, system behavior]
2. **[Error 2]**: [User-facing message, system behavior]

### Data Validation Rules
- [Validation rule 1]
- [Validation rule 2]

---

## 📦 Dependencies

### Blocking
- [ ] [Ticket/item that must complete first]

### Related
- [Ticket] - [Relationship]
- [Ticket] - [Relationship]

---

## 🎓 Definition of Done

### Code Quality
- [ ] All acceptance criteria scenarios implemented
- [ ] Unit test coverage ≥ 80%
- [ ] Integration test coverage = 100% (all scenarios)
- [ ] Linting passes with zero warnings
- [ ] Type checking passes (if applicable)
- [ ] Code formatted per project standards

### Testing
- [ ] All BDD scenarios have corresponding automated tests
- [ ] Manual testing completed for edge cases
- [ ] Error handling tested
- [ ] Performance tested (if applicable)

### Documentation
- [ ] API endpoints documented (if applicable)
- [ ] README updated (if user-facing feature)
- [ ] Prescriptive rules added to the relevant convention skill (`code-conventions`, `multi-file-workflows`, or `testing-conventions`); descriptive context flows to `docs/llm-wiki/` via `/wiki-refresh`

### Review & Deployment
- [ ] Code reviewed and approved
- [ ] PR merged to main
- [ ] Deployed to staging
- [ ] Stakeholders validated implementation

---

## 🎨 UI Testing (if applicable)

### Test Levels
| Level | Required | Tool | Status |
|-------|----------|------|--------|
| Unit | Yes/No | Vitest/Jest + RTL | - |
| Component | Yes/No | Playwright CT | - |
| E2E | Yes/No | Playwright | - |
| Visual | Yes/No | Playwright + pixelmatch | - |

### Figma Reference (if visual level)
- [Figma URL]

### Visual Testing Configuration (if visual level)
| Screen | Route | Figma Node | Viewport | Mode |
|--------|-------|------------|----------|------|
| [label] | [route] | [nodeId] | [WxH] | figma / screenshot / both |

---

## 📝 Implementation Notes

[Any additional context, helpful resources, or gotchas for implementer]

---

## 🔗 References

- [Design mockups URL]
- [Related documentation]
- [External resources]

---

**Created**: [Date]
**Created By**: Claude (create-sdd-ticket skill)
**INVEST Validated**: [✅/❌]
**BDD Scenarios**: [Count]
**Priority**: [High/Medium/Low]
**Labels**: [label1, label2, label3]
