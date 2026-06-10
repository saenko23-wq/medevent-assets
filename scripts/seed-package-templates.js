const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const taskSets = {
  STANDART: [
    ["collect_contact", "Collect company/product manager contact", "sales", "sales", ["company", "product_manager", "contact_person"]],
    ["confirm_speaker", "Confirm speaker", "project", "project", ["speaker"]],
    ["confirm_topic", "Confirm topic", "project", "project", ["topic"]],
    ["confirm_brand", "Confirm drug/brand mention", "content", "project", ["drug_or_brand"]],
    ["confirm_duration", "Confirm lecture duration: 20 + 5 Q&A", "project", "project", []],
    ["add_to_program", "Add lecture to program", "project", "project", ["topic", "speaker"]],
    ["presentation_received", "Confirm presentation received", "project", "project", ["presentation"]],
    ["speaker_mode", "Confirm speaker participation mode", "project", "project", ["speaker_participation_mode"]],
    ["basic_report", "Prepare basic report", "reports", "reports", []],
    ["nps", "Collect / attach NPS", "reports", "reports", []]
  ],
  PLUS: [
    ["preferred_slot", "Confirm preferred slot time", "project", "project", []],
    ["product_page_materials", "Collect product page materials", "content", "content", ["product_page_title", "product_description"]],
    ["brand_assets", "Collect product visual / photo / logo / brand assets", "content", "content", ["product_visual", "brand_assets"]],
    ["key_message", "Collect product description / key message", "content", "content", ["product_description"]],
    ["doclink_cta", "Collect DocLink CTA and target URL", "docs", "docs", ["doclink_cta", "doclink_target_url"]],
    ["promo_page", "Prepare product promo page", "content", "content", ["product_page_title"]],
    ["approve_promo_page", "Approve product promo page with partner", "content", "sales", []],
    ["recording_platform", "Prepare lecture recording for platform", "content", "content", []],
    ["publish_12m", "Publish recording on platform for 12 months", "content", "content", []],
    ["conspect", "Prepare lecture summary / conspect", "content", "content", []],
    ["cases_tests", "Prepare interactive cases or tests", "content", "content", ["case_or_test_material"]],
    ["survey", "Collect survey question / mini-poll", "content", "sales", ["survey_question"]],
    ["banner_item", "Prepare banner / video / article item", "content", "content", ["brand_assets"]],
    ["personal_mailing", "Prepare personalized mailing", "content", "content", ["mailing_approval"]],
    ["send_mailing", "Send mailing", "content", "content", ["mailing_approval"]],
    ["detailed_report", "Prepare detailed report", "reports", "reports", []],
    ["send_report", "Send report to partner", "reports", "reports", []]
  ],
  MONO: [
    ["mono_event", "Create mono event or child event", "project", "project", ["mono_topic"]],
    ["mono_concept", "Confirm mono concept and therapeutic focus", "project", "project", ["mono_topic"]],
    ["target_audience", "Confirm target doctor audience", "project", "sales", ["target_audience"]],
    ["mono_speakers", "Confirm speaker(s)", "project", "project", ["speaker"]],
    ["mono_agenda", "Confirm mono agenda", "project", "project", ["agenda"]],
    ["mono_duration", "Confirm duration up to 2h + 10-15 Q&A", "project", "project", []],
    ["mono_materials", "Collect product/brand materials", "content", "content", ["product_materials"]],
    ["mono_promo_page", "Prepare mono promo page", "content", "content", ["product_materials"]],
    ["registration_page", "Prepare registration page", "content", "content", ["registration_page_materials"]],
    ["mono_doclink", "Prepare DocLink", "docs", "docs", ["doclink_cta"]],
    ["mono_mailing", "Prepare mailing", "content", "content", ["mailing_approval"]],
    ["mono_publication", "Prepare platform publication", "content", "content", []],
    ["mono_analytics", "Prepare analytics report", "reports", "reports", []],
    ["mono_report_send", "Send report to partner", "reports", "reports", []]
  ],
  COMBO: [
    ["additional_video", "Prepare additional video content", "content", "content", ["additional_video_materials"]],
    ["shorts_reels", "Prepare shorts / reels", "content", "content", ["shorts_reels_approval"]],
    ["repeated_mailings", "Plan repeated mailings", "content", "content", ["second_mailing_approval"]],
    ["conference_touchpoint", "Track conference touchpoint", "project", "project", []],
    ["mono_touchpoint", "Track mono touchpoint", "project", "project", []],
    ["combined_report", "Prepare combined partner report", "reports", "reports", []]
  ]
};

const packageAliases = {
  STANDART: "Standart",
  PLUS: "Plus",
  MONO: "Mono",
  COMBO: "Combo"
};

async function main() {
  const packages = await prisma.participationPackage.findMany();
  const byName = new Map(packages.map((item) => [item.name.toUpperCase(), item]));

  const expanded = {
    STANDART: taskSets.STANDART,
    PLUS: [...taskSets.STANDART, ...taskSets.PLUS],
    MONO: taskSets.MONO,
    COMBO: [...taskSets.STANDART, ...taskSets.PLUS, ...taskSets.MONO, ...taskSets.COMBO]
  };

  for (const [code, tasks] of Object.entries(expanded)) {
    const pack = byName.get(packageAliases[code].toUpperCase());
    if (!pack) continue;
    for (const [serviceCode, title, process, ownerRole, requiredInputs] of tasks) {
      await prisma.packageServiceTemplate.upsert({
        where: { packageCode_serviceCode: { packageCode: code, serviceCode } },
        update: { title, process, defaultOwnerRole: ownerRole, requiredInputs: JSON.stringify(requiredInputs), isRequired: true },
        create: {
          packageId: pack.id,
          packageCode: code,
          serviceCode,
          title,
          process,
          defaultOwnerRole: ownerRole,
          requiredInputs: JSON.stringify(requiredInputs),
          deadlineRule: "+7d",
          isRequired: true
        }
      });
    }
  }
  console.log("Package service templates seeded");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
