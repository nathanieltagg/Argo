#ifndef DISPATCHERMESSAGE_H_5C0G5GNP
#define DISPATCHERMESSAGE_H_5C0G5GNP

#include <boost/asio.hpp>
#include "Logging.h"

namespace gov{
namespace fnal{
namespace uboone{
namespace dispatcher{

enum MsgType {
  kString = 0xfeed,
  kEvent =  0xbeef
};

class DispatcherMessage
{
public:
  // Create a binary payload for sending:
  DispatcherMessage()
    : m_payload(0)
  {
    m_header[0] = 2*sizeof(uint32_t);
    m_header[1] = 0; 
  }
  
  ~DispatcherMessage()
  {
    logVerbose << "!!! Deleting DispatcherMessage with data at " << std::hex << static_cast<void *>(m_payload);
    
    if(m_payload) delete [] m_payload;
  }
  

  // Functions for writing:
  DispatcherMessage(const std::string& s, MsgType t = kString) {
    m_header[0] = 2*sizeof(uint32_t) + s.length();
    m_header[1] = t;
    m_payload = new char[s.length()];
    strncpy(m_payload, s.c_str(), s.length());    
    logVerbose << "!!! Creating DispatcherMessage " << s.length() << " " << s;
  }

  DispatcherMessage(char* data, size_t size) {
    // takes ownership of data.
    m_header[0] = 2*sizeof(uint32_t) + size;
    m_header[1] = kEvent;
    m_payload = data;
    logVerbose << "!!! Creating DispatcherMessage from raw data at " << std::hex << static_cast<void *>(m_payload);;
    
  }
  
  

  // Functions for reading:
  void header_recieved() 
  {
    // Call when the header data has been loaded.
    if(m_payload) { delete [] m_payload; }
    if(payload_size() > 0) { 
      m_payload = new char[payload_size()];
    }
  }

  // Care must be taken that this object does not fall out of scope when these headers are being used.
  boost::asio::mutable_buffer header_buffer() { return boost::asio::buffer(m_header); }
  boost::asio::mutable_buffer payload_buffer() { return boost::asio::buffer(m_payload,payload_size()); }

  boost::asio::const_buffer header_buffer()  const { return boost::asio::buffer(m_header); }
  boost::asio::const_buffer payload_buffer() const { return boost::asio::buffer(m_payload,payload_size()); }

  size_t      size() const         { return m_header[0]; }
  size_t      payload_size() const { return m_header[0] - sizeof(uint32_t)*2; }
  uint32_t    type() const         { return m_header[1]; }
  const char* payload() const      { return m_payload; }

  std::string str() const { 
    if(m_payload && m_header[1]==kString) return std::string(m_payload,payload_size());
    return "invalidDispatcherMessage";
  }

  private:
  uint32_t m_header[2];
  char*    m_payload;
  
  
};

}}}} // namespace


#endif /* end of include guard: DISPATCHERMESSAGE_H_5C0G5GNP */

