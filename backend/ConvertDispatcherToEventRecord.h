#ifndef CONVERTDISPATCHERTOEVENTRECORD_H
#define CONVERTDISPATCHERTOEVENTRECORD_H

#include <memory>

namespace gov {
  namespace fnal {
    namespace uboone {
      namespace datatypes {
        class ub_EventRecord;
      }
    }
  }
}

namespace gov
{
namespace fnal
{
namespace uboone
{
namespace dispatcher
{

class DispatcherMessage;
std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> ConvertDispatcherToEventRecord(const DispatcherMessage*, bool unpack=true);

}}}} // namespace

#endif /* end of include guard: CONVERTDISPATCHERTOEVENTRECORD_H */
