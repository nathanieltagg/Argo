#ifndef CLIENT_H
#define CLIENT_H

//
// A class that connects to the dispatcher client.
//

#include <boost/asio.hpp>
#include <boost/thread/mutex.hpp>
#include <boost/thread/thread.hpp>
#include <boost/thread/condition.hpp>
#include <memory>
#include "DispatcherMessage.h"



namespace gov
{
namespace fnal
{
namespace uboone
{
namespace dispatcher
{

class Client
{
public:
  enum State_t {
    kUnknown   = 0,
    kClear,
    kWorking,
    kGotReply,
    kTimedOut,
    kError,
  };


  Client(bool threaded=true); // if true, it runs a seperate thread to copy data to and from the socket. If not, it will block while data is copied.
  ~Client();
  
  bool connect(const std::string& hostname, int port); // returns true if connection is good
  bool connect(const std::string& hostname, const std::string& port); // returns true if connection is good

  bool is_good()                                    // returns true if connection is good (no errors yet)
    { return (m_state != kError) && (m_state != kUnknown) && (m_state != kTimedOut ); };                                      
  
  bool send_request(const std::string& request_string, double timeout =-1);  // Start a request. If unthreaded, it will block.

  bool get_reply(std::string& outMetadata, std::shared_ptr<DispatcherMessage> &outData); // returns immediately. 
                                                                                         // false if no reply yet; true if reply is good
  bool wait_for_reply(std::string& outMetadata, std::shared_ptr<DispatcherMessage> &outData); // returns when next event ready.. 
                                                                                         // false if no reply yet; true if reply is good

  std::string error() const { return m_error; }; // ask what the error was.
  State_t  state() const { return m_state; }

 private:
   void finish_send_request(const boost::system::error_code& error, size_t );
   void read_stage_2(const boost::system::error_code& error, size_t );
   void read_stage_3(const boost::system::error_code& error, size_t );
   void read_stage_4(const boost::system::error_code& error, size_t );
   void finish_read(const boost::system::error_code& error, size_t );
   void did_not_get_response(const boost::system::error_code& error);
   
   void run();
   
   bool m_threaded;
   std::shared_ptr<boost::thread> m_thread;
   boost::mutex                   m_mutex;
   boost::condition               m_finished_condition;

 
   
   State_t                            m_state;
   typedef std::shared_ptr<DispatcherMessage> MsgPtr_t;
   MsgPtr_t m_request;
   MsgPtr_t m_reply_metadata;
   MsgPtr_t m_reply_data;
   
   boost::asio::io_service        m_service;
   // boost::asio::ip::tcp::resolver m_resolver;
   boost::asio::ip::tcp::socket   m_socket;
   boost::asio::deadline_timer    m_timeout_timer;
   std::string                    m_error;
};

}}}} // namespace
#endif /* end of include guard: CLIENT_H */
