"""
All LLM prompt templates for Marketing Automation AI agents.
System prompts are constants; user prompts are functions that accept parameters.
All prompts instruct the LLM to return valid JSON only (no markdown fences).
"""

# ─────────────────────────────────────────────────────────────
# AGENT 1: CONTENT WRITER & SEO
# ─────────────────────────────────────────────────────────────

BLOG_GENERATION_SYSTEM = """You are an expert SEO content writer for Vervotech, a travel technology company that provides hotel content APIs, hotel mapping, and data solutions for Online Travel Agencies (OTAs), Travel Management Companies (TMCs), and B2B travel platforms.

Write authoritative, well-structured blog posts targeting travel industry professionals. Your content should position Vervotech as a thought leader in travel technology.

IMPORTANT: Always respond with valid JSON only — no markdown code fences, no extra text before or after the JSON."""


def blog_generation_user(topic: str) -> str:
    return f"""Write a comprehensive 1500-word SEO-optimized blog post about: "{topic}"

Target audience: Online Travel Agencies, B2B travel platforms, Travel Management Companies, hotel chains
Tone: Authoritative, professional, enterprise B2B

Return a JSON object with exactly these fields:
{{
  "title": "SEO-optimized title (under 60 characters)",
  "meta_description": "Compelling meta description for Google (under 160 characters)",
  "slug": "url-friendly-slug-using-hyphens",
  "content_html": "Full 1500+ word blog post in HTML using h2, h3, p, ul, li tags. Include introduction, 3 main sections with subheadings, and conclusion.",
  "faq": [
    {{"question": "Frequently asked question 1?", "answer": "Detailed answer 1."}},
    {{"question": "Frequently asked question 2?", "answer": "Detailed answer 2."}},
    {{"question": "Frequently asked question 3?", "answer": "Detailed answer 3."}}
  ],
  "cta": "Call-to-action text encouraging readers to explore Vervotech solutions",
  "image_suggestions": [
    "Alt text for hero image",
    "Alt text for section image 1",
    "Alt text for section image 2"
  ],
  "primary_keyword": "main SEO keyword phrase",
  "secondary_keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
}}"""


INTERNAL_LINKING_SYSTEM = """You are an SEO specialist for Vervotech. Insert contextual internal links into blog HTML content pointing to relevant Vervotech product and resource pages.

IMPORTANT: Respond with valid JSON only — no markdown fences."""


def internal_linking_user(content_html: str, keywords: list) -> str:
    kw_list = ", ".join(keywords)
    vervotech_pages = [
        "/hotel-content-api", "/hotel-mapping", "/property-content",
        "/solutions/ota", "/solutions/tmc", "/blog", "/about",
        "/integrations", "/hotel-database", "/data-quality"
    ]
    pages_str = ", ".join(vervotech_pages)

    return f"""Insert 3–5 internal links into this blog post HTML content.

Target keywords to link: {kw_list}
Available Vervotech page slugs: {pages_str}

Rules:
- Link naturally within existing sentences (don't add new sentences)
- Use descriptive anchor text (not "click here")
- Each link format: <a href="/page-slug">anchor text</a>
- Don't link the same keyword twice

Return JSON:
{{
  "updated_html": "The complete HTML with links naturally inserted",
  "links_added": [
    {{"anchor": "anchor text used", "href": "/page-slug"}}
  ]
}}

Original HTML (first 4000 chars):
{content_html[:4000]}"""


QUALITY_CHECK_SYSTEM = """You are a content quality assurance specialist for Vervotech, a B2B travel technology company. Evaluate blog posts before publication.

IMPORTANT: Respond with valid JSON only — no markdown fences."""


def quality_check_user(title: str, content_html: str, topic: str) -> str:
    return f"""Evaluate this blog post for publication quality.

Topic: {topic}
Title: {title}

Content preview (first 2000 chars):
{content_html[:2000]}

Score on these criteria (out of 100 total):
- SEO optimization (title, meta hints, keyword density): 25 points
- Content quality, grammar, clarity: 25 points
- Logical structure and flow: 20 points
- Brand alignment (enterprise B2B travel tech): 15 points
- Target audience relevance (OTAs, TMCs, B2B): 15 points

A score of 70 or above = APPROVED. Below 70 = REJECTED.

Return JSON:
{{
  "verdict": "APPROVED",
  "score": 85,
  "reasons": ["Strong SEO title", "Well-structured content", "Good keyword usage"],
  "improvements": ["Could add more specific statistics", "FAQ section could be expanded"]
}}"""


LINKEDIN_POST_SYSTEM = """You are a B2B LinkedIn content expert for Vervotech, a travel technology company. Write engaging, professional posts that drive clicks and meaningful engagement.

IMPORTANT: Respond with valid JSON only — no markdown fences."""


def linkedin_post_user(blog_title: str, content_html: str, blog_url: str) -> str:
    # Extract plain text summary from HTML
    import re
    plain_text = re.sub(r'<[^>]+>', '', content_html)[:500]

    return f"""Write a LinkedIn post promoting this new Vervotech blog article.

Blog title: {blog_title}
Blog URL: {blog_url}
Content excerpt: {plain_text}

Requirements:
- Start with a compelling hook (question or bold statement)
- Include 2–3 key insights from the article
- Professional but engaging tone
- End with a clear CTA to read the full article
- Total length: 250–300 words
- Exactly 5 relevant hashtags

Return JSON:
{{
  "post_text": "Full LinkedIn post text here (250-300 words, with hook, insights, and CTA)",
  "hashtags": ["#TravelTech", "#AI", "#OTA", "#HotelTech", "#B2BSaaS"]
}}"""


# ─────────────────────────────────────────────────────────────
# AGENT 2: LEAD QUALIFICATION
# ─────────────────────────────────────────────────────────────

LEAD_ANALYSIS_SYSTEM = """You are a B2B sales qualification specialist for Vervotech, a hotel content API and mapping solution provider. Analyze company websites to determine if they are strong potential clients.

Vervotech's ideal customers: hotels, OTAs, travel agencies, tour operators, accommodation booking platforms, travel management companies, and travel technology companies.

IMPORTANT: Respond with valid JSON only — no markdown fences."""


def lead_analysis_user(email: str, website: str, homepage_text: str) -> str:
    return f"""Analyze this company as a potential Vervotech client.

Lead email: {email}
Company website: {website}
Website content (scraped):
{homepage_text[:3000] if homepage_text else "Could not scrape website content."}

Score this lead for fit with Vervotech (hotel content API and mapping solutions):

Scoring guide (out of 100):
- Travel/hospitality industry presence: up to 30 points
- Hotel/accommodation focus: up to 25 points
- B2B business model: up to 15 points
- Technical sophistication (API mentions, platform): up to 20 points
- Market relevance (OTA, TMC, booking platform): up to 10 points

Return JSON:
{{
  "score": 75,
  "industry_fit": true,
  "company_type": "ota",
  "reasoning": "2-3 sentence explanation of why this score was given",
  "signals": ["positive signal 1", "positive signal 2"],
  "concerns": ["concern 1 if any"]
}}

company_type options: "hotel_chain", "ota", "travel_agency", "tmc", "tour_operator", "tech_company", "booking_platform", "other"
Score > 70 = strong fit (Fit Client). Score <= 70 = not the right fit."""


# ─────────────────────────────────────────────────────────────
# AGENT 3: LINKEDIN OUTBOUND AUTOMATION
# ─────────────────────────────────────────────────────────────

PROSPECT_GENERATION_SYSTEM = """You are a B2B sales intelligence specialist for Vervotech, a hotel content API and mapping solution provider targeting travel industry companies. Generate realistic prospect profiles for outbound sales outreach.

Vervotech targets: OTAs, travel agencies, hotel chains, booking platforms, TMCs, tour operators.
Decision-maker personas: CTO, VP Technology, Product Head, Founder/CEO, Head of Supply, Head of Partnerships.

IMPORTANT: Respond with valid JSON only — no markdown fences."""


def prospect_generation_user(persona: str, industry: str = "travel technology", region: str = "Global") -> str:
    return f"""Generate 8 realistic B2B prospect profiles for Vervotech outreach.

Target persona: {persona}
Industry focus: {industry}
Region: {region}

Each prospect should work at a travel/hospitality company that would benefit from hotel content APIs or hotel mapping solutions.

Return a JSON array of 8 prospect objects:
[
  {{
    "id": "unique-id-string",
    "first_name": "realistic first name",
    "last_name": "realistic last name",
    "email": "firstname.lastname@companyname.com",
    "title": "{persona}",
    "company": "realistic travel company name",
    "company_type": "ota | hotel_chain | travel_agency | tmc | booking_platform | tour_operator",
    "website": "https://www.companyname.com",
    "linkedin_url": "https://www.linkedin.com/in/firstname-lastname",
    "region": "{region}",
    "employees": "50-500 | 500-2000 | 2000+",
    "status": "raw"
  }}
]

Make the companies and people realistic and diverse. Use varied company sizes and regions within {region}."""


PROSPECT_FILTER_SYSTEM = """You are a B2B sales SDR at Vervotech. Your job is to filter a list of prospects and remove anyone who is clearly not a decision-maker relevant to purchasing hotel content APIs or technology solutions.

Remove prospects with these titles (they cannot authorize technology purchases): Marketing, HR, Finance, Legal, Customer Support, Sales Rep, Account Executive.
Keep: CTO, VP Technology, Product Head, Founder, CEO, Head of Supply, Head of Partnerships, Technical Lead, Engineering Manager.

IMPORTANT: Respond with valid JSON only — no markdown fences."""


def prospect_filter_user(prospects_json: str) -> str:
    return f"""Filter this list of prospects. Remove any with titles that are not decision-makers for technology purchases (marketing, HR, finance, legal, support, sales reps).

For each prospect you KEEP, add a "relevance_reason" field explaining why they are a good fit.
Update the "status" field to "filtered" for all kept prospects.

Return a JSON array of only the kept prospects (same structure as input, with added relevance_reason and updated status):

Prospects to filter:
{prospects_json[:4000]}"""


# ─────────────────────────────────────────────────────────────
# AGENT 4: ANALYTICS & REPORTING
# ─────────────────────────────────────────────────────────────

REPORT_ANALYSIS_SYSTEM = """You are a B2B marketing analytics expert for Vervotech. Analyze multi-channel marketing performance data from AI agents and provide actionable insights.

IMPORTANT: Respond with valid JSON only — no markdown fences."""


def report_analysis_user(data_json: str) -> str:
    return f"""Analyze this marketing performance data from Vervotech's AI agent platform and generate a comprehensive performance report.

Data:
{data_json[:6000]}

Return a JSON analysis report:
{{
  "funnel_summary": {{
    "total_leads": 0,
    "hot_leads": 0,
    "warm_leads": 0,
    "cold_leads": 0,
    "fit_clients": 0,
    "outreach_targets": 0,
    "klenty_enrolled": 0,
    "blogs_published": 0,
    "conversion_rate_pct": 0.0
  }},
  "top_performing_content": [
    {{"title": "blog title", "quality_score": 0, "url": "url"}}
  ],
  "campaign_distribution": {{
    "campaign_a": 0,
    "campaign_b": 0,
    "campaign_c": 0,
    "not_fit": 0
  }},
  "key_insights": [
    "Insight 1: specific observation about the data",
    "Insight 2: specific observation about the data",
    "Insight 3: specific observation about the data"
  ],
  "recommendations": [
    "Recommendation 1: specific actionable recommendation",
    "Recommendation 2: specific actionable recommendation",
    "Recommendation 3: specific actionable recommendation"
  ],
  "health_score": 75,
  "health_rating": "Good | Excellent | Needs Attention | Critical"
}}"""


EXECUTIVE_SUMMARY_SYSTEM = """You are a business analyst writing a concise executive summary for a Vervotech marketing performance report. Write clearly and professionally for a C-suite audience.

IMPORTANT: Respond with valid JSON only — no markdown fences."""


def executive_summary_user(analysis_json: str) -> str:
    return f"""Write a concise executive summary based on this marketing performance analysis.

Analysis data:
{analysis_json[:4000]}

Return JSON:
{{
  "executive_summary": "3-5 paragraph executive summary covering: overall performance health, top metrics, key wins, areas of concern, and top 2-3 recommendations. Write in past tense, professional tone. Each paragraph 3-4 sentences.",
  "one_liner": "Single sentence describing overall campaign health and most important metric (e.g. 'This week generated 45 qualified leads with 62% conversion to Klenty campaigns, driven by strong content output of 7 published blogs.')"
}}"""
