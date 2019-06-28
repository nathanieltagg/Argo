#include "Client.h"
#include "Logging.h"

using boost::asio::ip::tcp;


// I see two ways a client might work:
// 
// 1) blocking:
//  Client c(false);
//  c.connect(...);
//  while(loop) {
//    c.send_request("requestTime=1");
//    c.wait_for_reply(maxtime);
//    c.get_reply(metadata,data); // blocks until data returned. Returns false if problem.
//    ...use the data...
//  }
//
// 2) non-blocking:
// Client c(true);
// c.connect(...);
// c.send_request("requestTime=1"); // requests data and tries to get reply
// while(loop) {
//   c.wait_for_reply(maxtime); // block for new data. optional; could just proceed.
//   c.get_reply(data,metadata); // make sure to deal with timeout or no-data-matched!
//   c.send_request(); // request another
//   ...use the data while another block is requested and inbound...
// }
//   
// So, the send_request() call has to start the async call chain: 
// send_request():
//   start a write with callback to finish_send_request()
//   also start a deadline timer for on did_not_get_response()
//   thread(service::run()).  This thread will detach and finish when the call sequence completes.
// finish_send_request()
//   .. which calls...
// start_read()
//   .. which calls back to...
// finish_read()
//   .. which signals(?) the main thread that data is ready? Yes: use a condition object
//


namespace gov
{
namespace fnal
{
namespace uboone
{
namespace dispatcher
{

Client::Client(bool threaded)
  : m_threaded(threaded)
  , m_state(kUnknown)
  , m_service()
  , m_socket(m_service)
  , m_timeout_timer(m_service)
{
}
   // if true, it runs a seperate thread to copy data to and from the socket. If not, it will block while data is copied.
Client::~Client()
{
}

void Client::run()
{
  logDebug << "Client::run()";
  m_service.reset();
  m_service.run();
  logDebug << "Client::run complete()";
  
}

bool Client::connect(const std::string& hostname, int port)
{
  // wrapper for int version of port. Calls string version.
  std::ostringstream oss;
  oss << port;
  return connect(hostname,oss.str());
}

bool Client::connect(const std::string& hostname, const std::string& port)
{
  // Connect to a dispatcher server.
  // returns true if connection is good
  logDebug << "Client::connect()";

  boost::mutex::scoped_lock guard(m_mutex);

  try {
    // Disconnect if connected.
    m_socket.close();
    // m_socket.open();

    boost::system::error_code err;
    tcp::resolver resolver(m_service);
    tcp::resolver::query query(hostname, port);
    tcp::resolver::iterator endpoint_iterator = resolver.resolve(query);
    boost::asio::connect(m_socket, endpoint_iterator);  
    if(err) {
      m_state = kError;
      m_error = err.message();
      return false;
    } else {
      m_state = kClear;
      return true;
    }
  } 
  catch(std::exception& e) {
    m_state = kError;
    m_error = e.what();
    return false;    
  }
} 

bool Client::send_request(const std::string& request_string, double timeout)
{
  // Call to request data from the dispatcher.
  // If threaded, will return right away and start readback in the background.
  // If non-threaded, will block until timeout is reached.
  // returns true if connection is good (no errors yet)
  // If timeout <=0 then it will never time out on the read.
  // logInfo << "Client::send_request()";


  if( (m_state != kClear) && (m_state != kGotReply) ) {
    return false; // We're in no condition to read right now!
  }
  
  m_request = MsgPtr_t(new DispatcherMessage(request_string));
  
  std::vector<boost::asio::const_buffer> outbufs;    
  outbufs.push_back(boost::asio::buffer(m_request->header_buffer()));
  outbufs.push_back(boost::asio::buffer(m_request->payload_buffer()));   
  
  boost::system::error_code err;    
  boost::asio::async_write(m_socket,
                           outbufs,
                           boost::bind(&Client::finish_send_request,this,_1,_2)
                           );   

  m_state = kWorking;

  if(timeout > 0){
    m_timeout_timer.cancel(); // just in case
    m_timeout_timer.expires_from_now(boost::posix_time::milliseconds(int(timeout*1000)));
    m_timeout_timer.async_wait(boost::bind(&Client::did_not_get_response,this,_1));
  } else {
    m_timeout_timer.cancel(); // just in case   
  }
 
  if(m_threaded) {
    // Double check we don't still have a thread running. 
    m_thread = std::shared_ptr<boost::thread>(new boost::thread(boost::bind(&Client::run,this)));
  } else {
    run();
  }
  return true;
} 


void Client::finish_send_request(const boost::system::error_code& error, size_t )
{
  // logInfo << "Client::finish_send_request()";
  
  boost::mutex::scoped_lock guard(m_mutex);
  
  if(error) {
    m_state = kError;
    m_error = error.message();
    m_timeout_timer.cancel(); // kill all operations
    m_socket.cancel(); // kill all operations
    m_finished_condition.notify_all(); // Complete!
    return;
  }
  
  // Start the read: get metadata header.
  m_reply_metadata = std::shared_ptr<DispatcherMessage>(new DispatcherMessage);
  m_reply_data     = std::shared_ptr<DispatcherMessage>(new DispatcherMessage);
  boost::asio::async_read(m_socket, // Get data from socket
    boost::asio::buffer(m_reply_metadata->header_buffer()), // Put it in our DispatcherMessage object
    boost::bind(&Client::read_stage_2, this, _1, _2) // and then return 
    );
}

void Client::read_stage_2(const boost::system::error_code& error, size_t bytes_read )
{
  // logInfo << "Client::read_stage_2()";
  
  boost::mutex::scoped_lock guard(m_mutex);
  
  // Continue read: get metadata string.
  if(error || bytes_read == 0) {
    m_state = kError;
    m_error = error.message();
    m_timeout_timer.cancel(); // kill all operations
    m_socket.cancel(); // kill all operations
    m_finished_condition.notify_all(); // Complete!
    return;
    // I shouldn't need this, but I need to do something.
  }
  
  m_reply_metadata->header_recieved();
  async_read(m_socket, // Get data from socket
            boost::asio::buffer(m_reply_metadata->payload_buffer()), // Put it in our DispatcherMessage object
            boost::bind(&Client::read_stage_3, this, _1, _2) // and then return 
            );
}

void Client::read_stage_3(const boost::system::error_code& error, size_t )
{
  // logInfo << "Client::read_stage_3()";
  
  boost::mutex::scoped_lock guard(m_mutex);
  
  // Continue read: get payload header.
  if(error) {
    m_state = kError;
    m_error = error.message();
    m_timeout_timer.cancel(); // kill all operations
    m_socket.cancel(); // kill all operations
    m_finished_condition.notify_all(); // Complete!
    return;
  }
  async_read(m_socket, // Get data from socket
            boost::asio::buffer(m_reply_data->header_buffer()), // Put it in our DispatcherMessage object
            boost::bind(&Client::read_stage_4, this, _1, _2) // and then return 
          );
}

void Client::read_stage_4(const boost::system::error_code& error, size_t )
{
  // logInfo << "Client::read_stage_4()";
  
  boost::mutex::scoped_lock guard(m_mutex);
  
  // Continue read: get payload header.
  if(error) {
    m_state = kError;
    m_error = error.message();
    m_timeout_timer.cancel(); // kill all operations
    m_socket.cancel(); // kill all operations
    m_finished_condition.notify_all(); // Complete!
     return; 
  }
  m_reply_data->header_recieved();
  
  async_read(m_socket, // Get data from socket
            boost::asio::buffer(m_reply_data->payload_buffer()), // Put it in our DispatcherMessage object
            boost::bind(&Client::finish_read, this, _1, _2) // and then return 
          );
}


void Client::finish_read(const boost::system::error_code& error, size_t )
{
  // logInfo << "Client::finish_read()";
  
  boost::mutex::scoped_lock guard(m_mutex);
  
  // Looks like we're finally done.
  if(error) {
    logInfo << "Client::finish_read error: " << error;
    m_state = kError;
    m_error = error.message();
    m_timeout_timer.cancel(); // kill all operations
    m_socket.cancel(); // kill all operations
    m_finished_condition.notify_all(); // Complete!
    return;
  } else {
    m_state= kGotReply;
    m_timeout_timer.cancel(); // No need, we're all done!     
    m_finished_condition.notify_all(); // Complete!
  }
 
}


void Client::did_not_get_response(const boost::system::error_code& error )
{
  logInfo << "Client::did_not_get_response()";
  
  boost::mutex::scoped_lock guard(m_mutex);

  if(error != boost::asio::error::operation_aborted) {
    logInfo << "Client::did_not_get_response() really didn't get a response.";
    
    // Callback when the timer goes off.
    m_state = kTimedOut;
    // Whelp, shut down this request.
    m_socket.cancel();
    m_finished_condition.notify_all();    
    return;
  }
}

bool Client::get_reply(std::string& metadata, std::shared_ptr<DispatcherMessage> &data) 
{
  // logInfo << "Client::get_reply()";
  
  boost::mutex::scoped_lock guard(m_mutex);
  // returns immediately false if no reply yet; true if reply is good
  if(m_state == kGotReply) {
    metadata   = m_reply_metadata->str();
    data       = m_reply_data;
    return true;
  }
  return false;
}

bool Client::wait_for_reply(std::string& metadata, std::shared_ptr<DispatcherMessage> &data)
{
  // logInfo << "Client::wait_for_reply()";

  {
    boost::mutex::scoped_lock guard(m_mutex);
    // blocks until there's a reply. returns true if reply is good.
    while(m_state == kWorking) {
      m_finished_condition.wait(m_mutex);
    }
  }
  return get_reply(metadata,data);
}


}}}} // namespace
