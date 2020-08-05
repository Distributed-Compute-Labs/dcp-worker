@echo off

set SchedulerURL=
FOR /F "usebackq skip=2 tokens=1,2,3*" %%A IN (`REG QUERY "HKLM\SOFTWARE\Kings Distributed Systems\DCP" /v "Scheduler URL" 2^>nul`) DO (
  set SchedulerURL=%%D
)
set SchedulerURLArgument=
if NOT "%SchedulerURL%"=="" (
  set SchedulerURLArgument=--scheduler="%SchedulerURL%"
)

set PaymentAddress=
FOR /F "usebackq skip=2 tokens=1,2,3*" %%A IN (`REG QUERY "HKLM\SOFTWARE\Kings Distributed Systems\DCP" /v "Payment Address" 2^>nul`) DO (
  set PaymentAddress=%%D
)
set PaymentAddressArgument=
if NOT "%PaymentAddress%"=="" (
  set PaymentAddressArgument="0x%PaymentAddress%"
)

pushd "%~dp0"
node dcp-worker start %PaymentAddressArgument% %SchedulerURLArgument%
popd
