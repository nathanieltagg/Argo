#include "Plexus.h"
#include "Logging.h"
#include "FormString.h"

// #include <sqlite3.h>
#include <libpq-fe.h>

Plexus::Plek::Plek()
  : crate (-1)  
  , card (-1)
  , channel (-1)
  , view ('-')
  , plane (-1)
  , planewire (-1)
  , wirenum (-1)
{
}

Plexus::Plexus( const std::string& interface,//="sqlite", 
                const std::string& connection //="my.db"
            )
 : m_ok(false)
{
  // if(interface == "sqlite") {
  //   int res = sqlite3_open(host_or_file.c_str(),&dblite);
  //   if(res) {
  //     logError << "Can't open sqlite3 database " << host_or_file << ":" << sqlite3_errmsg(dblite);
  //     sqlite3_close(dblite);
  //     return ;
  //   }
  // }

  if(interface == "postgresql") {
    PGconn *conn = PQconnectdb(connection.c_str());
    if(PQstatus(conn)!=CONNECTION_OK) {
      logError << "Couldn't open connection to postgresql interface at " << connection;
      PQfinish(conn);
      return;
    }

    PGresult *res  = PQexec(conn, "BEGIN");
    if (PQresultStatus(res) != PGRES_COMMAND_OK) { 
        logError << "postgresql BEGIN failed";
         PQclear(res);
         PQfinish(conn);
         return;
    }
    PQclear(res);
    
    res = PQexec(conn,
        "SELECT crate_id, slot, wireplane, wirenum, channel_id "
        " FROM channels NATURAL JOIN asics NATURAL JOIN motherboards NATURAL JOIN coldcables NATURAL JOIN motherboard_mapping NATURAL JOIN intermediateamplifiers NATURAL JOIN servicecables NATURAL JOIN servicecards NATURAL JOIN warmcables NATURAL JOIN ADCreceivers NATURAL JOIN crates NATURAL JOIN fecards "
    );
    if ((!res) || (PQresultStatus(res) != PGRES_TUPLES_OK))
    {
        logError << "SELECT command did not return tuples properly";
        PQclear(res);
        PQfinish(conn);
        return;
    }
    int num_records = PQntuples(res);
    for(int i=0;i<num_records;i++) {
      int crate_id = atoi(PQgetvalue(res, i, 0));
      int slot     = atoi(PQgetvalue(res, i, 1));
      char wireplane = *PQgetvalue(res, i, 2);
      int wirenum  = *PQgetvalue(res, i, 3);
      int channel_id = atoi(PQgetvalue(res, i, 4));
      int motherboard_channel = channel_id % 64;
      logVerbose << "   crate_id " << crate_id 
              << "   slot " << slot 
              << "   wireplane " << wireplane 
              << "   wirenum " << wirenum 
              << "   channel_id " << channel_id 
              << "   motherboard_channel " << motherboard_channel;
      PlekPtr_t p(new Plek);
      p->crate = crate_id;
      p->card = slot;
      p->channel = motherboard_channel;
      p->view = wireplane;
      switch(p->view) {
        case 'U' : p->plane = 0; break;
        case 'V' : p->plane = 1; break;
        case 'Y' : p->plane = 2; break;
        default :  p->plane = -1; break;
      }
      p->planewire = wirenum;
      p->wirenum = channel_id;
      m_ccc_to_plek[ccc(p->crate,p->card,p->channel)] = p;
    }

    
    PQclear(res);
    PQfinish(conn);
    
    m_ok = true;
  }
}

Plexus::~Plexus()
{
}

int Plexus::ccc(int crate, int card, int channel)
{
  return (20*crate + card)*64 + channel;
}

Plexus::PlekPtr_t Plexus::get(int crate, int card, int channel)
{
  MapType_t::iterator it = m_ccc_to_plek.find(ccc(crate,card,channel));
  if(it!=m_ccc_to_plek.end()) return it->second;
  static PlekPtr_t theDefault(new Plek);
  return theDefault;
}
