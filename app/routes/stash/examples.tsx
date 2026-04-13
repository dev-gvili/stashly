import {
  FeedbackFormCard,
  FitnessSummaryCard,
  AnomalyAlertCard,
  BookAppointmentCard,
  FileUploadCard,
  AudioWaveformCard,
  SleepReportCard,
  AnalyticsCard,
  VisitorsChartCard,
  TransactionListCard,
  PreferencesCard,
  NavigationCard,
  FaqCard,
  PaymentSettingsCard,
  TransferFundsCard,
  RevenueChartCard,
  StockHoldingsCard,
  SmartLockCard,
  CodespacesCard,
  ContributionsActivityCard,
  CycleUsageCard,
  DistributionCard,
  FaqAccordionCard,
  InvestmentSearchCard,
  InviteTeamCard,
  NavigationMenuCard,
  NoTeamMembersCard,
  NotificationsCard,
  PaymentsCard,
  SavingsGoalCard,
  ShortcutsCard,
  UploadArtworkCard,
  VercelAgentCard,
  VisitorsCard,
} from '@/components/core-components/card-examples'

export default function Examples() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-xs gap-2 *:mb-2">
        <FeedbackFormCard />
        <FitnessSummaryCard />
        <AnomalyAlertCard />
        <BookAppointmentCard />
        <FileUploadCard />
        <AudioWaveformCard />
        <SleepReportCard />
        <AnalyticsCard />
        <VisitorsChartCard />
        <TransactionListCard />
        <PreferencesCard />
        <NavigationCard />
        <FaqCard />
        <PaymentSettingsCard />
        <TransferFundsCard />
        <RevenueChartCard />
        <StockHoldingsCard />
        <SmartLockCard />
        <CodespacesCard />
        <ContributionsActivityCard />
        <CycleUsageCard />
        <DistributionCard />
        <FaqAccordionCard />
        <InvestmentSearchCard />
        <InviteTeamCard />
        <NavigationMenuCard />
        <NoTeamMembersCard />
        <NotificationsCard />
        <PaymentsCard />
        <SavingsGoalCard />
        <ShortcutsCard />
        <UploadArtworkCard />
        <VercelAgentCard />
        <VisitorsCard />
      </div>
    </div>
  )
}
