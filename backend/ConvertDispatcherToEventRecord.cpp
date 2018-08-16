// Prevents ASSERT on boolean values not being 1 or zero
#define BOOST_DISABLE_ASSERTS 1
// 
#include "ConvertDispatcherToEventRecord.h"

#include "DispatcherMessage.h"
#include <numeric>
#include "datatypes/raw_data_access.h"
#include "datatypes/ub_EventRecord.h"
#include "datatypes/ub_PMT_CrateData_v6.h"
#include "datatypes/ub_TPC_CrateData_v6.h"
#include "Logging.h"

#include <boost/asio.hpp>
#include <boost/archive/binary_iarchive.hpp>
#include <boost/serialization/map.hpp>
#include <boost/serialization/list.hpp>
#include <boost/serialization/string.hpp>
#include <boost/serialization/version.hpp>
#include <boost/serialization/split_member.hpp>
#include <boost/iostreams/stream_buffer.hpp>
#include <boost/iostreams/stream.hpp>

using gov::fnal::uboone::datatypes::ub_EventRecord;
using gov::fnal::uboone::dispatcher::DispatcherMessage;
using namespace gov::fnal::uboone::dispatcher;

std::shared_ptr<ub_EventRecord> 
        gov::fnal::uboone::dispatcher::ConvertDispatcherToEventRecord(const DispatcherMessage* data,bool unpack)
{
  //
  // Unpack a raw dispatcher message into a full-blown set of data.
  //

  std::shared_ptr<ub_EventRecord> r; // null return pointer
  if(!data) return r;
  if(data->payload_size()==0) return r; // nothing to do; leave defaults.

  try {
    // ok, try to unpack the darned event.
    namespace io = boost::iostreams;
    io::basic_array_source<char> source(data->payload(),data->payload_size());
    io::stream<io::basic_array_source <char> > input_stream(source);
    boost::archive::binary_iarchive ia(input_stream);

    // Don't unpack data crates if it's not requested.
    // Efficiency boost under some conditions
    pmt_crate_data_t::doDissect(unpack);
    tpc_crate_data_t::doDissect(unpack);
    trig_crate_data_t::doDissect(true);  // Always unpack the trigger. It's lightweight and has important stuff.

    r = std::shared_ptr<ub_EventRecord>(new ub_EventRecord);
    ia >> *r;
    
    return r;
  }
  catch ( std::exception& e ) {
    logError << "Failed to unpack event record." << e.what() ;
    return std::shared_ptr<ub_EventRecord>(); // Return an empty pointer.
  }
  return r;
}

