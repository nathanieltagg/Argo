
// Prevents ASSERT on boolean values not being 1 or zero
#define BOOST_DISABLE_ASSERTS 1

#include "DaqFile.h"

#include "datatypes/ub_EventRecord.h"
#include <boost/archive/binary_iarchive.hpp>
#include <boost/serialization/map.hpp>
#include <boost/serialization/list.hpp>
#include <boost/serialization/string.hpp>
#include <boost/serialization/version.hpp>
#include <boost/serialization/split_member.hpp>
#include <boost/iostreams/stream_buffer.hpp>
#include <boost/iostreams/stream.hpp>

using gov::fnal::uboone::datatypes::ub_EventRecord;

DaqFile::DaqFile( const std::string& pathname )
  : good(false)
  , closedCleanly(false)
  , m_entry(0)
  , nevents(-1)
  , ifs(pathname,std::ios::binary)
{
  good = true;
  if( (!ifs.is_open()) || (!ifs.good()) ) {
    good = false;
    return;
  }
  // get length of file:
  ifs.seekg (0, ifs.end);
  uint64_t length = ifs.tellg();
  if(length < 6) {
    good = false;
    closedCleanly = false;
    return;
  }

  ifs.seekg(-6,ifs.end); // Go to position 6 bytes before end of file.
  uint8_t buff[10];
  ifs.read((char*) buff, 6);

  #pragma GCC diagnostic push
  #pragma GCC diagnostic ignored "-Wstrict-aliasing"
  // Danger danger will robinson!  Endian totally unchecked!
  nevents = *(uint32_t*)(buff);
  #pragma GCC diagnostic pop
  
  //cout << " nevents = " << std::dec << nevents << endl;
  uint16_t endOfFileMarker = *(uint16_t*)(buff+4);
  // cout << " eof marker = 0x" << std::hex << endOfFileMarker << endl;
  ifs.clear();    
  ifs.seekg(0,ifs.beg);

  // cout << std::dec << nevents << " events in file." << endl;
  closedCleanly = true;
  if(endOfFileMarker != 0xe0f0) {
    closedCleanly = false;
    nevents = 0;
    return;
  }

  uint64_t index_pos = 6 + sizeof(uint32_t)*nevents;
  ifs.clear();
  index_buffer.resize(nevents);
  ifs.seekg(-index_pos,ifs.end);
  ifs.read((char*)(&index_buffer[0]),sizeof(uint32_t)*nevents);  
  ifs.seekg(0,ifs.beg);
}


DaqFile::~DaqFile()
{
}

// bool DaqFile::GetEventData(unsigned int entry, char* &outEventData, size_t &outEventSize)
// {
//   // Return true if good.
//
//   if( !good  ) return false; // fail
//
//   // Skip in stages: this prevents integer overflow from skipping many GB at a time!
//   outEventData = 0;
//   outEventSize = 0;
//   if(entry>=nevents) return 0;
//
//   ifs.seekg(0,ifs.beg);
//   for(unsigned int i=0;i<entry;i++) ifs.seekg(index_buffer[i],ifs.cur);
//   ifs.clear();
//   outEventSize = index_buffer[entry];
//
//   // Read it.
//   outEventData = new char[outEventSize];
//   ifs.read((char*)outEventData, outEventSize);
//
//   return false;
// }

std::shared_ptr<ub_EventRecord> DaqFile::GetEvent(size_t entry, bool unpack)
{
  namespace io = boost::iostreams;
  
  
  // Can we skip to the right entry?
  if(closedCleanly) {
    // Look up position in the table and skip.
    ifs.seekg(0,ifs.beg);
    for(size_t i=0;i<entry;i++) ifs.seekg(index_buffer[i],ifs.cur);
    ifs.clear();    
  } else {
    // Read successive records until we get there.
    // Slow, but it should work.
    size_t num_to_skip = 0;
    if(entry < m_entry) { 
      // Need to rewind.
      num_to_skip = entry;
      ifs.seekg(0,ifs.beg);
      m_entry = 0;
    } else {
      num_to_skip = entry - m_entry;    
    }
    
    for(size_t i=0;i<num_to_skip;i++) {
      ub_EventRecord dummy;
      dummy.setCrateSerializationMask(0); // FIXME. Don't want to unpack!
      try {
        boost::archive::binary_iarchive ia(ifs); // declare a boost::archive::binary_iarchive object
        ia >> dummy;  // read in from the archive into your ub_EventRecord object
        m_entry++;
      } catch ( std::exception& e ) {
        throw std::runtime_error("Daqfile Could not read event entry " + std::to_string(m_entry) + "error: " +e.what());
        
        // Not needed, but what the heck.
        return std::shared_ptr<ub_EventRecord>(); // null pointer.
      }        
    }    
  }


  // We should now be at the correct file position to read.

  try {
    boost::archive::binary_iarchive ia(ifs); // declare a boost::archive::binary_iarchive object
    std::shared_ptr<ub_EventRecord> r(new ub_EventRecord);
    if(!unpack) r->setCrateSerializationMask(0); // fixme
    ia >> *r;
    m_entry++;
    return r;
  }
  catch ( std::exception& e ) {
    throw std::runtime_error("Daqfile Could not read event entry " + std::to_string(m_entry) + "error: " +e.what());
  }

  return std::shared_ptr<ub_EventRecord>(); // Return an empty pointer.
}

std::shared_ptr<ub_EventRecord> DaqFile::GetNextEvent(bool unpack)
{
  // This version just attempts to read the file directly.
  // More useful if the file wasn't closed correctly.

  std::shared_ptr<ub_EventRecord> r = std::shared_ptr<ub_EventRecord>(new ub_EventRecord);
  if(!unpack) r->setCrateSerializationMask(0); // FIXME
  try {
    boost::archive::binary_iarchive ia(ifs); // declare a boost::archive::binary_iarchive object
    ia >> *r;  // read in from the archive into your ub_EventRecord object
    m_entry++;
    return r;
  }
  catch ( std::exception& e ) {
    throw std::runtime_error("Daqfile Could not read event entry " + std::to_string(m_entry) + "error: " +e.what());
  }

  return std::shared_ptr<ub_EventRecord>(); // Return an empty pointer.
}

